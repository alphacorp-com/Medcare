import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isUuid, parseBeneficiary, parsePolicy, type PolicyInput } from "@/lib/coverage/input";
import { coverPatient, POLICY_INCLUDE } from "@/lib/coverage/policies";
import { facilityPatient } from "@/lib/coverage/references";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// A patient's third-party payment: the memberships they are covered by (as holder or dependant,
// with the other beneficiaries and their authorizations), free-care enrolments, and the
// programmes available for enrolment.

// GET /api/v1/patients/[id]/coverage
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await billingGuard("read");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  if (!(await facilityPatient(guard.tenantId, id))) return coverageError("not_found", 404);
  const coverages = await prisma.patientCoverage.findMany({
    where: { tenantId: guard.tenantId, patientId: id },
    include: { policy: { include: POLICY_INCLUDE }, authorizations: { orderBy: { validFrom: "desc" } } },
    orderBy: { validFrom: "desc" },
  });
  const exemptions = await prisma.patientExemption.findMany({
    where: { tenantId: guard.tenantId, patientId: id },
    include: { program: { select: { id: true, code: true, name: true, rate: true } } },
    orderBy: { validFrom: "desc" },
  });
  const enrolmentPrograms = await prisma.exemptionProgram.findMany({ where: { tenantId: guard.tenantId, isActive: true, eligibility: "enrolment" }, select: { id: true, code: true, name: true, rate: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ data: { coverages, exemptions, enrolmentPrograms } });
}

// POST /api/v1/patients/[id]/coverage
// Body: { policyId } (join an existing membership) or { policy: { agreementId, memberNumber, holderName,
// holderPatientId?, employer?, validFrom, validTo?, notes? } } (new membership), plus the beneficiary:
// { relationship (holder|spouse|child|other), beneficiaryNumber?, validFrom?, validTo? }.
// The patient's open invoices without a coverage take this one and are recomputed.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("create");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    if (!(await facilityPatient(guard.tenantId, id))) return coverageError("not_found", 404);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return coverageError("invalid_body");
    const beneficiary = parseBeneficiary(body, { partial: true });
    if (!beneficiary.ok) return coverageError(beneficiary.error);
    if (!beneficiary.value.relationship) return coverageError("invalid_relationship");
    let target: { policyId: string } | { policy: PolicyInput };
    if (body.policyId !== undefined) {
      if (!isUuid(body.policyId)) return coverageError("invalid_policy");
      target = { policyId: body.policyId };
    } else {
      const policy = parsePolicy(body.policy, { partial: false });
      if (!policy.ok) return coverageError(policy.error);
      target = { policy: policy.value as PolicyInput };
    }
    const { coverage, policyId } = await coverPatient(guard.tenantId, guard.userId, id, target, beneficiary.value);
    await prisma.patientInvoice.updateMany({
      where: { tenantId: guard.tenantId, patientId: id, coverageId: null, status: { in: ["draft", "pending_payment", "partially_paid"] }, claimItems: { none: {} } },
      data: { coverageId: coverage.id },
    });
    const recomputed = await recalcOpenInvoices({ tenantId: guard.tenantId, coverageId: coverage.id });
    await auditCoverage(request, guard, "coverage.patient_coverage_create", "patient_coverage", coverage.id, { patientId: id, policyId, relationship: coverage.relationship, newPolicy: "policy" in target, recomputedInvoices: recomputed });
    return NextResponse.json({ data: coverage, recomputedInvoices: recomputed }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/patients/[id]/coverage");
  }
}
