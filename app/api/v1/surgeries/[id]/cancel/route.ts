import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/surgeries/[id]/cancel
// Body: { reason }
// Allowed from "scheduled" or "postponed". Terminal — a cancelled case cannot be edited further.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const { reason } = await req.json();
    if (!reason?.trim()) {
      return NextResponse.json({ error: "A reason is required to cancel a case" }, { status: 400 });
    }

    const surgery = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

    if (surgery.status !== "scheduled" && surgery.status !== "postponed") {
      return NextResponse.json({ error: `Cannot cancel a case with status "${surgery.status}"` }, { status: 400 });
    }

    const updated = await prisma.surgicalProcedure.update({
      where: { id },
      data: { status: "cancelled", complications: { cancelReason: reason } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error cancelling surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
