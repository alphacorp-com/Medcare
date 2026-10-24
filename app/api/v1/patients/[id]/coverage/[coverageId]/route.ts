import { NextResponse } from "next/server";
import { parseBeneficiary } from "@/lib/coverage/input";
import { updateBeneficiary } from "@/lib/coverage/policies";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// PATCH /api/v1/patients/[id]/coverage/[coverageId]
// Body: beneficiary fields (relationship, beneficiaryNumber, validFrom, validTo, notes), or { end: true }
// to remove the patient from the membership now. Open invoices under it are recomputed.
export async function PATCH(request: Request, context: { params: Promise<{ id: string; coverageId: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id, coverageId } = await context.params;
    const body = await request.json().catch(() => null);
    const end = typeof body === "object" && body !== null && (body as Record<string, unknown>).end === true;
    let change: Parameters<typeof updateBeneficiary>[3] = "end";
    if (!end) {
      const parsed = parseBeneficiary(body, { partial: true });
      if (!parsed.ok) return coverageError(parsed.error);
      change = parsed.value;
    }
    const updated = await updateBeneficiary(guard.tenantId, id, coverageId, change);
    const recomputed = await recalcOpenInvoices({ tenantId: guard.tenantId, coverageId });
    await auditCoverage(request, guard, end ? "coverage.patient_coverage_end" : "coverage.patient_coverage_update", "patient_coverage", coverageId, { patientId: id, changes: change, recomputedInvoices: recomputed });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/patients/[id]/coverage/[coverageId]");
  }
}
