import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireTenantAdmin } from "@/lib/permissions";

// PATCH /api/v1/planning/schedules/[id]/replace
// Body: { replacementUserId }
// Marks the original shift as "replaced" and gives the substitute their own
// confirmed shift for the same date/type/department — the first real use of
// Schedule.replacedBy in the codebase.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const { replacementUserId } = await req.json();
    if (!replacementUserId) {
      return NextResponse.json({ error: "replacementUserId is required" }, { status: 400 });
    }

    const original = await prisma.schedule.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!original) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

    if (replacementUserId === original.userId) {
      return NextResponse.json({ error: "The replacement must be a different staff member" }, { status: 400 });
    }

    const [updatedOriginal] = await prisma.$transaction([
      prisma.schedule.update({
        where: { id },
        data: { status: "replaced", replacedBy: replacementUserId },
      }),
      prisma.schedule.upsert({
        where: {
          userId_date_shiftType: {
            userId: replacementUserId,
            date: original.date,
            shiftType: original.shiftType,
          },
        },
        create: {
          tenantId: session.user.tenantId,
          userId: replacementUserId,
          departmentId: original.departmentId,
          shiftType: original.shiftType,
          date: original.date,
          startTime: original.startTime,
          endTime: original.endTime,
          status: "confirmed",
          notes: `Covering for a replaced shift`,
        },
        update: { status: "confirmed" },
      }),
    ]);

    return NextResponse.json(updatedOriginal);
  } catch (error) {
    console.error("Error replacing schedule:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
