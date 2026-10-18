import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { releaseInvoiceLines } from "@/lib/billing/release";

// POST /api/v1/billing/[id]/waive — body: { reason }
// Lets care proceed before payment (indigent patient, management decision…): releases the
// admission and exams this invoice was holding in "awaiting_payment". The invoice itself is
// untouched and still owed. The reason is required and lands in both the audit log and the
// invoice notes, so the cashier sees why it was let through.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!reason?.trim()) {
      return NextResponse.json({ error: "A reason is required to waive payment" }, { status: 400 });
    }

    const invoice = await prisma.patientInvoice.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { lines: { select: { sourceType: true, sourceId: true } } },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (invoice.status === "cancelled") {
      return NextResponse.json({ error: "Cannot waive payment on a cancelled invoice" }, { status: 400 });
    }

    const released = await releaseInvoiceLines(invoice.tenantId, invoice.lines);
    if (released.stays === 0 && released.exams === 0 && released.hospitalizations === 0) {
      return NextResponse.json({ error: "Nothing on this invoice is waiting for payment" }, { status: 400 });
    }

    const stamp = `[Dérogation de paiement — ${new Date().toISOString().slice(0, 16).replace("T", " ")} — ${session.user.name ?? session.user.id}: ${reason.trim()}]`;
    await prisma.patientInvoice.update({
      where: { id },
      data: { notes: invoice.notes ? `${invoice.notes}\n${stamp}` : stamp },
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "billing.payment_waived",
      resourceType: "patient_invoice",
      resourceId: id,
      payload: {
        reason: reason.trim(),
        releasedStays: released.stays,
        releasedExams: released.exams,
        releasedHospitalizations: released.hospitalizations,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: released, success: true });
  } catch (error) {
    console.error("[POST /api/v1/billing/[id]/waive]", error);
    return NextResponse.json({ error: "Failed to waive payment" }, { status: 500 });
  }
}
