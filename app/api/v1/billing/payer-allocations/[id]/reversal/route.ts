import { NextResponse } from "next/server";
import { reverseAllocation } from "@/lib/coverage/claims";
import { parseReason } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// POST /api/v1/billing/payer-allocations/[id]/reversal — Body: { reason }
// Undoes an allocation of a payer settlement (wrong invoice): the amount is unallocated again.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const reason = parseReason(await request.json().catch(() => null));
    if (!reason.ok) return coverageError(reason.error);
    const allocation = await reverseAllocation(guard.tenantId, guard.userId, id);
    await auditCoverage(request, guard, "billing.payer_allocation_reversal", "payer_payment_allocation", id, { paymentId: allocation.paymentId, amount: Number(allocation.amount), reason: reason.value });
    return NextResponse.json({ data: { id, reversed: true } });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/billing/payer-allocations/[id]/reversal");
  }
}
