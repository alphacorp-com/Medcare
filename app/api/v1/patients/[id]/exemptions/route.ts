import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseExemptionGrant } from "@/lib/coverage/input";
import { facilityPatient } from "@/lib/coverage/references";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// POST /api/v1/patients/[id]/exemptions — Body: { programId, validFrom, validTo?, reason }
// Enrols the patient in a free-care programme of the "enrolment" kind (indigents…). A financial
// decision: MODULE_BILLING "validate", a mandatory reason, audited. Open invoices are recomputed.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("validate");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    if (!(await facilityPatient(guard.tenantId, id))) return coverageError("not_found", 404);
    const parsed = parseExemptionGrant(await request.json().catch(() => null));
    if (!parsed.ok) return coverageError(parsed.error);
    const program = await prisma.exemptionProgram.findFirst({ where: { id: parsed.value.programId, tenantId: guard.tenantId, isActive: true, eligibility: "enrolment" }, select: { id: true, code: true } });
    if (!program) return coverageError("invalid_program");
    const exemption = await prisma.patientExemption.create({ data: { ...parsed.value, tenantId: guard.tenantId, patientId: id, grantedById: guard.userId } });
    const recomputed = await recalcOpenInvoices({ tenantId: guard.tenantId, patientId: id });
    await auditCoverage(request, guard, "coverage.exemption_grant", "patient_exemption", exemption.id, { patientId: id, program: program.code, reason: parsed.value.reason, validTo: parsed.value.validTo, recomputedInvoices: recomputed });
    return NextResponse.json({ data: exemption }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/patients/[id]/exemptions");
  }
}
