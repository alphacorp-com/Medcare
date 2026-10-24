import { NextResponse } from "next/server";
import { refundPayerPayment } from "@/lib/coverage/claims";
import { parsePayerRefund } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// POST /api/v1/billing/payer-payments/[id]/refunds — Body: { amount, refundedAt, reference?, reason }
// Gives part of the unallocated balance back to the payer. Money leaves: "validate", audited.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("validate");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const parsed = parsePayerRefund(await request.json().catch(() => null));
    if (!parsed.ok) return coverageError(parsed.error);
    const refund = await refundPayerPayment(guard.tenantId, guard.userId, id, parsed.value);
    await auditCoverage(request, guard, "billing.payer_payment_refund", "payer_payment", id, { amount: parsed.value.amount, reason: parsed.value.reason, reference: parsed.value.reference });
    return NextResponse.json({ data: refund }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/billing/payer-payments/[id]/refunds");
  }
}
