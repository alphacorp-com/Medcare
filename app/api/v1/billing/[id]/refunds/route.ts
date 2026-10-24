import { NextResponse } from "next/server";
import { recordPatientRefund } from "@/lib/billing/refunds";
import { parsePatientRefund } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// POST /api/v1/billing/[id]/refunds
// Body: { kind: "refund", amount, method, reference?, reason, refundedAt? }
//     | { kind: "transfer", amount, targetInvoiceId, reason, refundedAt? }
// Gives back, or moves to another open invoice of the same patient, what the patient paid
// beyond their share on this invoice. Money leaves the till: MODULE_BILLING "validate", audited.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("validate");
    if (!guard.ok) return guard.response;
    const { id } = await params;
    const parsed = parsePatientRefund(await request.json().catch(() => null));
    if (!parsed.ok) return coverageError(parsed.error);
    const refund = await recordPatientRefund(guard.tenantId, guard.userId, id, parsed.value);
    await auditCoverage(request, guard, parsed.value.kind === "refund" ? "billing.patient_refund" : "billing.overpayment_transfer", "patient_invoice", id, {
      amount: parsed.value.amount, reason: parsed.value.reason, ...(parsed.value.kind === "transfer" ? { targetInvoiceId: parsed.value.targetInvoiceId } : { method: parsed.value.method, reference: parsed.value.reference }),
    });
    return NextResponse.json({ data: refund }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/billing/[id]/refunds");
  }
}
