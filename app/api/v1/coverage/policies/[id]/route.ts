import { NextResponse } from "next/server";
import { parsePolicy } from "@/lib/coverage/input";
import { updatePolicy } from "@/lib/coverage/policies";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// PATCH /api/v1/coverage/policies/[id] — Body: membership fields (memberNumber, holderName, employer,
// validFrom, validTo, notes) or { end: true }: ends the membership for every beneficiary. The open
// invoices of all its beneficiaries are recomputed.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const end = typeof body === "object" && body !== null && (body as Record<string, unknown>).end === true;
    let change: Parameters<typeof updatePolicy>[2] = "end";
    if (!end) {
      const parsed = parsePolicy(body, { partial: true });
      if (!parsed.ok) return coverageError(parsed.error);
      change = parsed.value;
    }
    const updated = await updatePolicy(guard.tenantId, id, change);
    const recomputed = await recalcOpenInvoices({ tenantId: guard.tenantId, coverage: { policyId: id } });
    await auditCoverage(request, guard, end ? "coverage.policy_end" : "coverage.policy_update", "coverage_policy", id, { changes: change, recomputedInvoices: recomputed });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/coverage/policies/[id]");
  }
}
