import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── PATCH /api/v1/exam-requests/:id/cancel ──────────────────────────────────
// Cancels a medical-act order before it's completed — no billing, nothing to reverse.
// Same type/status restrictions as the complete route (see that file for why).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error, success: false }, { status: permCheck.status });
    }

    const { id } = await params;

    const exam = await prisma.examRequest.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!exam) {
      return NextResponse.json({ error: "Order not found", success: false }, { status: 404 });
    }

    if (exam.type === "biology" || exam.type === "radiology") {
      return NextResponse.json(
        { error: "Laboratory and radiology orders must be cancelled from their own module", success: false },
        { status: 400 }
      );
    }

    if (exam.status !== "requested") {
      return NextResponse.json(
        { error: `Cannot cancel an order with status "${exam.status}"`, success: false },
        { status: 400 }
      );
    }

    const updated = await prisma.examRequest.update({
      where: { id },
      data: { status: "cancelled" },
    });

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/exam-requests/:id/cancel]", error);
    return NextResponse.json({ error: "Failed to cancel order", success: false }, { status: 500 });
  }
}
