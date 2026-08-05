import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/laboratory/[id]/cancel
// Body: { reason }
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_LAB", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const { reason } = await req.json();
    if (!reason?.trim()) {
      return NextResponse.json({ error: "A reason is required to cancel an exam" }, { status: 400 });
    }

    const exam = await prisma.examRequest.findUnique({ where: { id } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status !== "requested" && exam.status !== "in_progress") {
      return NextResponse.json({ error: `Cannot cancel an exam with status "${exam.status}"` }, { status: 400 });
    }

    const updated = await prisma.examRequest.update({
      where: { id },
      data: {
        status: "cancelled",
        notes: exam.notes ? `${exam.notes}\n[Cancelled: ${reason}]` : `[Cancelled: ${reason}]`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error cancelling lab exam:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
