import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { suggestInvoiceLine } from "@/lib/billing/suggestCharge";

// ── PATCH /api/v1/exam-requests/:id/complete ────────────────────────────────
// Completes a medical-act order (cardiology/pathology/other — anything that isn't a
// Laboratory or Radiology exam, which have their own dedicated collect → result → validate
// workflow and must go through those modules instead). A medical act has no separate result
// to record, so it goes straight from "requested" to "completed" and bills immediately —
// same suggestInvoiceLine call shape as the lab/radiology validate routes.
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
        { error: "Laboratory and radiology orders must be completed from their own module", success: false },
        { status: 400 }
      );
    }

    if (exam.status !== "requested") {
      return NextResponse.json(
        { error: `Cannot complete an order with status "${exam.status}"`, success: false },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await prisma.examRequest.update({
      where: { id },
      data: { status: "completed", completedAt: now },
    });

    const billing = session.user.tenantId
      ? await suggestInvoiceLine({
          tenantId: session.user.tenantId,
          patientId: exam.patientId,
          stayId: exam.stayId,
          sourceType: "exam",
          sourceId: exam.id,
          description: exam.examLabel,
          feeCode: exam.examCode,
          performedById: session.user.id,
        })
      : null;

    return NextResponse.json({ data: updated, billing, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/exam-requests/:id/complete]", error);
    return NextResponse.json({ error: "Failed to complete order", success: false }, { status: 500 });
  }
}
