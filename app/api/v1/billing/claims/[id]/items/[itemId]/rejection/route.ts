import { NextResponse } from "next/server";
import { recordRejection } from "@/lib/coverage/claims";
import { parseRejection } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// POST /api/v1/billing/claims/[id]/items/[itemId]/rejection — Body: { amount, reason, chargeToPatient? }
// The payer refuses (part of) an invoice: written off, or charged back to the patient (who then
// owes it on the invoice). Audited.
export async function POST(request: Request, context: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id, itemId } = await context.params;
    const parsed = parseRejection(await request.json().catch(() => null));
    if (!parsed.ok) return coverageError(parsed.error);
    await recordRejection(guard.tenantId, id, itemId, parsed.value);
    await auditCoverage(request, guard, "billing.claim_rejection", "insurance_claim_item", itemId, { claimId: id, ...parsed.value });
    return NextResponse.json({ data: { itemId, ...parsed.value } }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/billing/claims/[id]/items/[itemId]/rejection");
  }
}
