import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// PATCH /api/v1/patients/[id]/exemptions/[exemptionId] — Body: { revoke: true, reason }
// Ends a free-care enrolment ("validate", audited). Open invoices are recomputed.
export async function PATCH(request: Request, context: { params: Promise<{ id: string; exemptionId: string }> }) {
  try {
    const guard = await billingGuard("validate");
    if (!guard.ok) return guard.response;
    const { id, exemptionId } = await context.params;
    const exemption = await prisma.patientExemption.findFirst({ where: { id: exemptionId, tenantId: guard.tenantId, patientId: id } });
    if (!exemption) return coverageError("not_found", 404);
    const body = (await request.json().catch(() => null)) as { revoke?: unknown; reason?: unknown } | null;
    if (body?.revoke !== true) return coverageError("invalid_body");
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 5 || reason.length > 500) return coverageError("invalid_reason");
    if (exemption.revokedAt) return coverageError("exemption_revoked");
    await prisma.patientExemption.update({ where: { id: exemptionId }, data: { revokedAt: new Date(), revokedById: guard.userId } });
    const recomputed = await recalcOpenInvoices({ tenantId: guard.tenantId, patientId: id });
    await auditCoverage(request, guard, "coverage.exemption_revoke", "patient_exemption", exemptionId, { patientId: id, reason, recomputedInvoices: recomputed });
    return NextResponse.json({ data: { id: exemptionId, revoked: true } });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/patients/[id]/exemptions/[exemptionId]");
  }
}
