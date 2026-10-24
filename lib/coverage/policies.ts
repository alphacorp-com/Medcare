import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { CoverageError } from "@/lib/coverage/claims";
import { withinPolicy, type BeneficiaryInput, type PolicyInput } from "@/lib/coverage/input";

// Memberships ("adhésions") and their beneficiaries. Rules enforced here (the routes only parse):
//   - a member number is unique within a convention: covering a second member of the family
//     attaches them to the existing membership, it never creates a twin;
//   - one holder per membership; when the holder is a patient of the facility they are its
//     "holder" beneficiary;
//   - a beneficiary's dates lie within the membership's (a dependant never outlives it);
//   - the convention and its payer must be active to add someone.

type Tx = Prisma.TransactionClient;

export const POLICY_INCLUDE = {
  agreement: { select: { id: true, code: true, name: true, requiresAuthorization: true, childMaxAgeYears: true, isActive: true, payer: { select: { id: true, name: true, isActive: true } } } },
  beneficiaries: { select: { id: true, patientId: true, relationship: true, beneficiaryNumber: true, endedAt: true, patient: { select: { firstName: true, lastName: true, ipp: true } } }, orderBy: { createdAt: "asc" } },
} as const;

async function lockPolicy(tx: Tx, policyId: string) {
  await tx.$queryRaw`SELECT id FROM "tenant_template"."coverage_policies" WHERE id = ${policyId}::uuid FOR UPDATE`;
}

async function addBeneficiary(
  tx: Tx,
  tenantId: string,
  userId: string,
  policy: { id: string; holderPatientId: string | null; validFrom: Date; validTo: Date | null; endedAt: Date | null },
  patientId: string,
  b: Partial<BeneficiaryInput>
) {
  if (policy.endedAt) throw new CoverageError("policy_ended");
  const relationship = b.relationship ?? "holder";
  if (relationship === "holder") {
    if (policy.holderPatientId && policy.holderPatientId !== patientId) throw new CoverageError("holder_mismatch");
    const otherHolder = await tx.patientCoverage.findFirst({ where: { policyId: policy.id, relationship: "holder", patientId: { not: patientId } }, select: { id: true } });
    if (otherHolder) throw new CoverageError("holder_exists");
    if (!policy.holderPatientId) await tx.coveragePolicy.update({ where: { id: policy.id }, data: { holderPatientId: patientId } });
  } else if (policy.holderPatientId === patientId) {
    throw new CoverageError("holder_mismatch");
  }
  const dates = { validFrom: b.validFrom ?? policy.validFrom, validTo: b.validTo !== undefined && b.validTo !== null ? b.validTo : policy.validTo };
  if (!withinPolicy(dates, policy)) throw new CoverageError("dates_outside_policy");
  const existing = await tx.patientCoverage.findUnique({ where: { policyId_patientId: { policyId: policy.id, patientId } }, select: { id: true } });
  if (existing) throw new CoverageError("already_beneficiary");
  return tx.patientCoverage.create({
    data: { tenantId, patientId, policyId: policy.id, relationship, beneficiaryNumber: b.beneficiaryNumber ?? null, ...dates, notes: b.notes ?? null, createdById: userId },
  });
}

// Covers a patient: on an existing membership (policyId), or on a new one. A new membership whose
// holder is another patient of the facility also covers that patient as its holder.
export async function coverPatient(
  tenantId: string,
  userId: string,
  patientId: string,
  input: { policyId: string } | { policy: PolicyInput },
  beneficiary: Partial<BeneficiaryInput>
) {
  return prisma.$transaction(async (tx) => {
    let policy;
    if ("policyId" in input) {
      await lockPolicy(tx, input.policyId);
      policy = await tx.coveragePolicy.findFirst({ where: { id: input.policyId, tenantId }, include: { agreement: { select: { isActive: true, payer: { select: { isActive: true } } } } } });
      if (!policy) throw new CoverageError("invalid_policy");
    } else {
      const p = input.policy;
      const agreement = await tx.coverageAgreement.findFirst({ where: { id: p.agreementId, tenantId }, select: { id: true } });
      if (!agreement) throw new CoverageError("invalid_agreement");
      const twin = await tx.coveragePolicy.findFirst({ where: { agreementId: p.agreementId, memberNumber: p.memberNumber }, select: { id: true } });
      if (twin) throw new CoverageError("member_number_exists");
      if (p.holderPatientId && p.holderPatientId !== patientId) {
        const holder = await tx.patient.findFirst({ where: { id: p.holderPatientId, tenantId }, select: { id: true } });
        if (!holder) throw new CoverageError("invalid_holder");
      }
      // The patient covered as holder is the membership's holder, under their own name.
      const holderPatientId = beneficiary.relationship === "holder" ? patientId : p.holderPatientId;
      let holderName = p.holderName;
      if (holderPatientId) {
        const holder = await tx.patient.findFirst({ where: { id: holderPatientId, tenantId }, select: { firstName: true, lastName: true } });
        if (holder) holderName = `${holder.lastName} ${holder.firstName}`;
      }
      policy = await tx.coveragePolicy.create({
        data: { ...p, holderName, holderPatientId: null, tenantId, createdById: userId },
        include: { agreement: { select: { isActive: true, payer: { select: { isActive: true } } } } },
      });
      if (holderPatientId && holderPatientId !== patientId) {
        await addBeneficiary(tx, tenantId, userId, policy, holderPatientId, { relationship: "holder" });
        policy = { ...policy, holderPatientId };
      }
    }
    if (!policy.agreement.isActive || !policy.agreement.payer.isActive) throw new CoverageError("invalid_agreement");
    const coverage = await addBeneficiary(tx, tenantId, userId, policy, patientId, beneficiary);
    return { coverage, policyId: policy.id };
  });
}

// Changes a beneficiary line (relationship, number, dates) or removes it from the membership.
export async function updateBeneficiary(tenantId: string, patientId: string, coverageId: string, change: Partial<BeneficiaryInput> | "end") {
  return prisma.$transaction(async (tx) => {
    const current = await tx.patientCoverage.findFirst({ where: { id: coverageId, tenantId, patientId }, include: { policy: true } });
    if (!current) throw new CoverageError("not_found", 404);
    await lockPolicy(tx, current.policyId);
    if (change === "end") {
      if (current.endedAt) throw new CoverageError("coverage_ended");
      return tx.patientCoverage.update({ where: { id: coverageId }, data: { endedAt: new Date() } });
    }
    if (change.relationship && change.relationship !== current.relationship) {
      if (change.relationship === "holder") {
        if (current.policy.holderPatientId && current.policy.holderPatientId !== patientId) throw new CoverageError("holder_mismatch");
        const otherHolder = await tx.patientCoverage.findFirst({ where: { policyId: current.policyId, relationship: "holder", id: { not: coverageId } }, select: { id: true } });
        if (otherHolder) throw new CoverageError("holder_exists");
        await tx.coveragePolicy.update({ where: { id: current.policyId }, data: { holderPatientId: patientId } });
      } else if (current.relationship === "holder") {
        // The holder becomes a dependant: the membership no longer has a patient holder.
        await tx.coveragePolicy.update({ where: { id: current.policyId }, data: { holderPatientId: null } });
      }
    }
    const dates = { validFrom: change.validFrom ?? current.validFrom, validTo: change.validTo !== undefined ? change.validTo : current.validTo };
    if (!withinPolicy(dates, current.policy)) throw new CoverageError("dates_outside_policy");
    const { validFrom: _f, validTo: _t, ...rest } = change;
    return tx.patientCoverage.update({ where: { id: coverageId }, data: { ...rest, ...dates } });
  });
}

// Changes a membership (member number, holder name, employer, dates) or ends it — every
// beneficiary loses the coverage.
export async function updatePolicy(tenantId: string, policyId: string, change: Partial<PolicyInput> | "end") {
  return prisma.$transaction(async (tx) => {
    await lockPolicy(tx, policyId);
    const policy = await tx.coveragePolicy.findFirst({ where: { id: policyId, tenantId } });
    if (!policy) throw new CoverageError("not_found", 404);
    if (change === "end") {
      if (policy.endedAt) throw new CoverageError("policy_ended");
      return tx.coveragePolicy.update({ where: { id: policyId }, data: { endedAt: new Date() } });
    }
    const { agreementId: _a, holderPatientId: _h, ...fields } = change;
    if (fields.memberNumber && fields.memberNumber !== policy.memberNumber) {
      const twin = await tx.coveragePolicy.findFirst({ where: { agreementId: policy.agreementId, memberNumber: fields.memberNumber, id: { not: policyId } }, select: { id: true } });
      if (twin) throw new CoverageError("member_number_exists");
    }
    const from = fields.validFrom ?? policy.validFrom;
    const to = fields.validTo !== undefined ? fields.validTo : policy.validTo;
    if (to && from > to) throw new CoverageError("invalid_dates");
    return tx.coveragePolicy.update({ where: { id: policyId }, data: fields });
  });
}
