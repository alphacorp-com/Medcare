import { NextResponse } from "next/server";
import { reverseRejection } from "@/lib/coverage/claims";
import { parseReason } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// POST /api/v1/billing/claims/[id]/rejections/[rejectionId]/reversal — Body: { reason }
// Undoes a rejection (recorded by mistake, or the payer pays after all). Audited.
export async function POST(request: Request, context: { params: Promise<{ id: string; rejectionId: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id, rejectionId } = await context.params;
    const reason = parseReason(await request.json().catch(() => null));
    if (!reason.ok) return coverageError(reason.error);
    await reverseRejection(guard.tenantId, guard.userId, id, rejectionId, reason.value);
    await auditCoverage(request, guard, "billing.claim_rejection_reversal", "insurance_claim_rejection", rejectionId, { claimId: id, reason: reason.value });
    return NextResponse.json({ data: { id: rejectionId, reversed: true } });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/billing/claims/[id]/rejections/[rejectionId]/reversal");
  }
}
