import { NextResponse } from "next/server";
import { allocatePayerPayment } from "@/lib/coverage/claims";
import { isUuid } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// POST /api/v1/billing/payer-payments/[id]/allocations — Body: { claimId?, allocations?: [{ itemId, amount }] }
// Allocates the unallocated balance of a settlement (oldest items first when no list is given).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { claimId?: unknown; allocations?: unknown };
    if (body.claimId != null && body.claimId !== "" && !isUuid(body.claimId)) return coverageError("invalid_claim");
    let allocations: { itemId: string; amount: number }[] | null = null;
    if (body.allocations != null) {
      if (!Array.isArray(body.allocations) || body.allocations.length > 500) return coverageError("invalid_allocations");
      allocations = [];
      const seen = new Set<string>();
      for (const a of body.allocations as { itemId?: unknown; amount?: unknown }[]) {
        if (!isUuid(a?.itemId) || seen.has(a.itemId) || !Number.isInteger(a.amount) || (a.amount as number) <= 0) return coverageError("invalid_allocations");
        seen.add(a.itemId);
        allocations.push({ itemId: a.itemId, amount: a.amount as number });
      }
    }
    const allocated = await allocatePayerPayment(guard.tenantId, id, (body.claimId as string) || null, allocations);
    await auditCoverage(request, guard, "billing.payer_payment_allocate", "payer_payment", id, { allocated, claimId: body.claimId ?? null });
    return NextResponse.json({ data: { allocated } }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/billing/payer-payments/[id]/allocations");
  }
}
