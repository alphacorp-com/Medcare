import { Prisma, type BillingSourceType, type CoverageStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { computeInvoiceCoverage, type CoverageFamily, type CoverageLine, type CoverageTerms, type ProgramRule } from "@/lib/coverage/compute";
import { beneficiaryValidity, calendarYear, dayOf, MS_PER_DAY, within, type BeneficiaryTerms } from "@/lib/coverage/validity";

// Loads what the coverage computation needs for one invoice and writes the split back on its
// lines. Runs inside the invoice recalculation transaction (lib/billing/suggestCharge.ts):
// the invoice row is locked by the caller, and the membership / authorization are locked here
// so that two invoices of the same family never consume the same ceiling concurrently.

type Tx = Prisma.TransactionClient;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function familyOf(sourceType: BillingSourceType, examType?: string | null): CoverageFamily {
  switch (sourceType) {
    case "consultation":
      return "consultation";
    case "hospitalization":
      return "hospitalization";
    case "exam":
      return examType === "radiology" ? "imaging" : "laboratory";
    case "surgery":
      return "surgery";
    case "pharmacy_dispensation":
      return "pharmacy";
    case "antenatal_visit":
    case "delivery":
      return "maternity";
    default:
      return "other";
  }
}

const BENEFICIARY_INCLUDE = {
  policy: { select: { id: true, validFrom: true, validTo: true, endedAt: true, agreement: { include: { rates: true, payer: { select: { isActive: true } } } } } },
  patient: { select: { birthDate: true } },
} as const;

type BeneficiaryRow = Prisma.PatientCoverageGetPayload<{ include: typeof BENEFICIARY_INCLUDE }>;

function termsOf(c: BeneficiaryRow): BeneficiaryTerms {
  const a = c.policy.agreement;
  return {
    relationship: c.relationship,
    validFrom: c.validFrom,
    validTo: c.validTo,
    endedAt: c.endedAt,
    policy: c.policy,
    agreement: { isActive: a.isActive, validFrom: a.validFrom, validTo: a.validTo, childMaxAgeYears: a.childMaxAgeYears, payerActive: a.payer.isActive },
  };
}

// The coverage applied by default to a new invoice: a beneficiary line of the patient valid on
// `at` (membership, convention, age limit); the most recently started one when there are several.
export async function defaultCoverageFor(db: Tx | typeof prisma, tenantId: string, patientId: string, at: Date): Promise<string | null> {
  const day = dayOf(at);
  const candidates = await db.patientCoverage.findMany({
    where: { tenantId, patientId, endedAt: null, validFrom: { lte: day }, OR: [{ validTo: null }, { validTo: { gte: day } }] },
    include: BENEFICIARY_INCLUDE,
    orderBy: { validFrom: "desc" },
  });
  return candidates.find((c) => beneficiaryValidity(termsOf(c), c.patient.birthDate, at).valid)?.id ?? null;
}

// An invoice put in a claim: its shares are what was claimed (a rejected part is reversed or
// settled on the same claim item, never claimed twice).
export async function isClaimed(db: Tx | typeof prisma, invoiceId: string): Promise<boolean> {
  return (await db.insuranceClaimItem.count({ where: { invoiceId } })) > 0;
}

export interface AppliedCoverage {
  insuranceAmount: number;
  exemptionAmount: number;
  coverageStatus: CoverageStatus;
  authorizationId: string | null;
}

interface InvoiceForCoverage {
  id: string;
  tenantId: string | null;
  patientId: string;
  stayId: string | null;
  coverageId: string | null;
  authorizationId: string | null;
  createdAt: Date;
}

export async function applyCoverage(tx: Tx, invoice: InvoiceForCoverage): Promise<AppliedCoverage> {
  const tenantId = invoice.tenantId;
  const lines = await tx.patientInvoiceLine.findMany({
    where: { invoiceId: invoice.id },
    select: { id: true, sourceType: true, sourceId: true, amount: true, payerAmount: true, exemptionAmount: true, exemptionProgramId: true },
  });
  const sum = (key: "payerAmount" | "exemptionAmount") => lines.reduce((s, l) => s + Number(l[key]), 0);

  if (await isClaimed(tx, invoice.id)) {
    return { insuranceAmount: sum("payerAmount"), exemptionAmount: sum("exemptionAmount"), coverageStatus: "frozen", authorizationId: invoice.authorizationId };
  }
  if (!tenantId) return { insuranceAmount: 0, exemptionAmount: 0, coverageStatus: "none", authorizationId: null };

  const at = invoice.createdAt;
  const day = dayOf(at);

  // Families, codes and nomenclature rates of the lines. Sequential: queries of an interactive
  // transaction share one connection.
  const idsOf = (type: BillingSourceType) => lines.filter((l) => l.sourceType === type && l.sourceId && UUID.test(l.sourceId)).map((l) => l.sourceId!);
  const stayIds = [...new Set([...idsOf("consultation"), ...idsOf("hospitalization")])];
  const exams = idsOf("exam").length ? await tx.examRequest.findMany({ where: { tenantId, id: { in: idsOf("exam") } }, select: { id: true, type: true, examCode: true } }) : [];
  const surgeries = idsOf("surgery").length ? await tx.surgicalProcedure.findMany({ where: { tenantId, id: { in: idsOf("surgery") } }, select: { id: true, procedureCode: true } }) : [];
  const stays = stayIds.length ? await tx.stay.findMany({ where: { tenantId, id: { in: stayIds } }, select: { id: true, medicalActCode: true, hospitalizationActCode: true } }) : [];
  const examById = new Map(exams.map((e) => [e.id, e]));
  const surgeryById = new Map(surgeries.map((s) => [s.id, s]));
  const stayById = new Map(stays.map((s) => [s.id, s]));
  const resolved = lines.map((l) => {
    const exam = l.sourceType === "exam" && l.sourceId ? examById.get(l.sourceId) : undefined;
    const stay = l.sourceId ? stayById.get(l.sourceId) : undefined;
    const code =
      l.sourceType === "exam" ? exam?.examCode ?? null
      : l.sourceType === "surgery" ? surgeryById.get(l.sourceId ?? "")?.procedureCode ?? null
      : l.sourceType === "consultation" ? stay?.medicalActCode ?? null
      : l.sourceType === "hospitalization" ? stay?.hospitalizationActCode ?? null
      : null;
    // Pharmacy lines are keyed "<prescriptionId>:<inventoryItemId>".
    const itemId = l.sourceType === "pharmacy_dispensation" ? l.sourceId?.split(":")[1] ?? null : null;
    return { line: l, examType: exam?.type, code, itemId: itemId && UUID.test(itemId) ? itemId : null };
  });
  const codes = [...new Set(resolved.map((r) => r.code).filter((c): c is string => Boolean(c)))];
  const nomenclature = codes.length
    ? new Map((await tx.medicalAct.findMany({ where: { tenantId, code: { in: codes }, defaultPecCoveragePercent: { not: null } }, select: { code: true, defaultPecCoveragePercent: true } })).map((a) => [a.code, a.defaultPecCoveragePercent]))
    : new Map<string, number | null>();
  const coverageLines: CoverageLine[] = resolved.map((r) => ({
    id: r.line.id, amount: Number(r.line.amount), family: familyOf(r.line.sourceType, r.examType), code: r.code, inventoryItemId: r.itemId,
    nomenclatureRate: r.code ? nomenclature.get(r.code) ?? null : null,
  }));

  // Patient profile on the invoice date.
  const patient = await tx.patient.findUniqueOrThrow({ where: { id: invoice.patientId }, select: { birthDate: true, gender: true } });
  const pregnant = (await tx.pregnancy.count({ where: { tenantId, patientId: invoice.patientId, status: "ongoing" } })) > 0;
  const ageMonths = Math.max(0, Math.floor((at.getTime() - patient.birthDate.getTime()) / (MS_PER_DAY * 30.4375)));

  // Free-care programmes valid on that day, with the patient's enrolments.
  const programs = await tx.exemptionProgram.findMany({ where: { tenantId, isActive: true } });
  const enrolments = await tx.patientExemption.findMany({ where: { tenantId, patientId: invoice.patientId, revokedAt: null }, select: { programId: true, validFrom: true, validTo: true } });
  const enrolled = new Set(enrolments.filter((e) => within(day, e.validFrom, e.validTo)).map((e) => e.programId));
  const rules: ProgramRule[] = programs
    .filter((p) => within(day, p.validFrom, p.validTo))
    .map((p) => ({
      id: p.id, code: p.code, rate: p.rate, families: p.families, actCodes: p.actCodes, inventoryItemIds: p.inventoryItemIds, eligibility: p.eligibility,
      minAgeMonths: p.minAgeMonths, maxAgeMonths: p.maxAgeMonths, sex: p.sex, pregnantOnly: p.pregnantOnly, enrolled: enrolled.has(p.id),
    }));

  // Payer terms.
  let terms: CoverageTerms | null = null;
  let authorizationId = invoice.authorizationId;
  if (invoice.coverageId) {
    const coverage = await tx.patientCoverage.findFirst({ where: { id: invoice.coverageId, tenantId, patientId: invoice.patientId }, include: BENEFICIARY_INCLUDE });
    if (coverage) {
      // The membership is the unit of the family ceiling: every beneficiary's invoice locks it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${coverage.policy.id}))`;
      const agreement = coverage.policy.agreement;
      const validity = beneficiaryValidity(termsOf(coverage), coverage.patient.birthDate, at);
      const year = calendarYear(at);
      const usedBy = async (where: Prisma.PatientInvoiceWhereInput) =>
        Number(
          (await tx.patientInvoice.aggregate({ where: { ...where, id: { not: invoice.id }, status: { not: "cancelled" }, createdAt: { gte: year.start, lt: year.end } }, _sum: { insuranceAmount: true } }))._sum
            .insuranceAmount ?? 0
        );
      const annualRemaining = agreement.annualCeiling === null ? null : Number(agreement.annualCeiling) - (await usedBy({ coverageId: coverage.id }));
      const familyRemaining = agreement.familyAnnualCeiling === null ? null : Number(agreement.familyAnnualCeiling) - (await usedBy({ coverage: { policyId: coverage.policy.id } }));

      // Prior authorization: an explicit one, else the first valid one of this beneficiary.
      const authorizationUsable = (a: { status: string; coverageId: string; validFrom: Date; validTo: Date; stayId: string | null }) =>
        a.status === "active" && a.coverageId === coverage.id && within(day, a.validFrom, a.validTo) && (!a.stayId || a.stayId === invoice.stayId);
      const remainingOf = async (a: { id: string; authorizedAmount: Prisma.Decimal | null }) => {
        if (a.authorizedAmount === null) return null;
        const used = await tx.patientInvoice.aggregate({ where: { authorizationId: a.id, id: { not: invoice.id }, status: { not: "cancelled" } }, _sum: { insuranceAmount: true } });
        return Number(a.authorizedAmount) - Number(used._sum.insuranceAmount ?? 0);
      };
      let authorization: CoverageTerms["authorization"] = null;
      if (!authorizationId && agreement.requiresAuthorization && validity.valid) {
        const candidates = await tx.coverageAuthorization.findMany({ where: { tenantId, coverageId: coverage.id, status: "active" }, orderBy: { validTo: "asc" } });
        for (const candidate of candidates) {
          if (!authorizationUsable(candidate)) continue;
          const remaining = await remainingOf(candidate);
          if (remaining === null || remaining > 0) {
            authorizationId = candidate.id;
            break;
          }
        }
      }
      if (authorizationId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${authorizationId}))`;
        const a = await tx.coverageAuthorization.findFirst({ where: { id: authorizationId, tenantId } });
        authorization = a ? { valid: authorizationUsable(a), remaining: await remainingOf(a) } : { valid: false, remaining: null };
      }

      terms = {
        valid: validity.valid,
        invalidReason: !validity.valid && validity.reason === "age_limit" ? "age_limit" : null,
        defaultRate: agreement.defaultRate,
        rates: Object.fromEntries(agreement.rates.map((r) => [r.family, r.rate])),
        useNomenclatureRates: agreement.useNomenclatureRates,
        perInvoiceCeiling: agreement.perInvoiceCeiling === null ? null : Number(agreement.perInvoiceCeiling),
        annualRemaining,
        familyRemaining,
        requiresAuthorization: agreement.requiresAuthorization,
        authorizationThreshold: agreement.authorizationThreshold === null ? null : Number(agreement.authorizationThreshold),
        authorization,
      };
    } else {
      // The coverage no longer exists for this patient / facility: treated as invalid.
      terms = { valid: false, defaultRate: 0, rates: {}, perInvoiceCeiling: null, annualRemaining: null, requiresAuthorization: false, authorizationThreshold: null, authorization: null };
    }
  }

  const result = computeInvoiceCoverage({ lines: coverageLines, patient: { ageMonths, sex: patient.gender, pregnant }, programs: rules, coverage: terms });

  const byId = new Map(lines.map((l) => [l.id, l]));
  for (const share of result.lines) {
    const current = byId.get(share.id)!;
    if (Number(current.payerAmount) === share.payerAmount && Number(current.exemptionAmount) === share.exemptionAmount && current.exemptionProgramId === share.exemptionProgramId) continue;
    await tx.patientInvoiceLine.update({ where: { id: share.id }, data: { payerAmount: share.payerAmount, exemptionAmount: share.exemptionAmount, exemptionProgramId: share.exemptionProgramId } });
  }

  return { insuranceAmount: result.payerAmount, exemptionAmount: result.exemptionAmount, coverageStatus: result.outcome, authorizationId };
}
