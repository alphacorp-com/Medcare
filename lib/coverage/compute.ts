// Third-party payment of an invoice ("prise en charge"): who pays what on each line.
// Pure — the loader (lib/coverage/apply.ts) resolves the line families, the eligible
// programmes and the remaining ceilings; this decides the split.
//
// Order, per line:
//   1. a free-care programme (gratuité) pays `rate` % of the line — the most generous
//      applicable programme wins;
//   2. the payer pays its convention rate of the rest: the act's nomenclature rate when the
//      convention applies the nomenclature and the act has one, else the family rate, else the
//      convention's default rate;
//   3. the patient pays the remainder.
// Then, on the invoice: a prior authorization may be required (no payer share without a valid
// one), and the payer share is limited by the per-invoice ceiling, what is left of the annual
// ceilings (the beneficiary's and the membership's — holder and dependants share it) and what is
// left of the authorization amount.
// Amounts are whole FCFA (XAF has no subunit).

export const COVERAGE_FAMILIES = ["consultation", "laboratory", "imaging", "pharmacy", "hospitalization", "surgery", "maternity", "other"] as const;
export type CoverageFamily = (typeof COVERAGE_FAMILIES)[number];

export type CoverageOutcome = "none" | "applied" | "capped" | "authorization_required" | "invalid_coverage" | "age_limit_exceeded";

export interface CoverageLine {
  id: string;
  amount: number;
  family: CoverageFamily;
  // Exam / medical act code of the line, pharmacy article, when known (programme restrictions).
  code: string | null;
  inventoryItemId: string | null;
  // Nomenclature rate of the act behind the line (MedicalAct.defaultPecCoveragePercent), if any.
  nomenclatureRate?: number | null;
}

export interface PatientProfile {
  ageMonths: number;
  sex: string | null;
  pregnant: boolean;
}

export interface ProgramRule {
  id: string;
  code: string;
  rate: number;
  families: readonly CoverageFamily[];
  actCodes: readonly string[];
  inventoryItemIds: readonly string[];
  eligibility: "automatic" | "enrolment";
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  sex: string | null;
  pregnantOnly: boolean;
  // For "enrolment" programmes: the patient holds a valid enrolment.
  enrolled: boolean;
}

export interface CoverageTerms {
  // Coverage valid on the invoice date (beneficiary, membership, convention and payer).
  valid: boolean;
  // Why it is not valid, when the reason has its own outcome.
  invalidReason?: "age_limit" | null;
  defaultRate: number;
  rates: Partial<Record<CoverageFamily, number>>;
  useNomenclatureRates?: boolean;
  perInvoiceCeiling: number | null;
  // What is left of the annual ceilings (other invoices deducted): this beneficiary's, and the
  // membership's (all its beneficiaries).
  annualRemaining: number | null;
  familyRemaining?: number | null;
  requiresAuthorization: boolean;
  authorizationThreshold: number | null;
  // The authorization attached to the invoice: valid on its date, and what is left of its amount.
  authorization: { valid: boolean; remaining: number | null } | null;
}

export interface LineShare {
  id: string;
  exemptionAmount: number;
  exemptionProgramId: string | null;
  payerAmount: number;
}

export interface CoverageResult {
  lines: LineShare[];
  exemptionAmount: number;
  payerAmount: number;
  outcome: CoverageOutcome;
}

const pct = (amount: number, rate: number) => Math.round((amount * rate) / 100);

export function programApplies(program: ProgramRule, patient: PatientProfile, line: CoverageLine): boolean {
  if (!program.families.includes(line.family)) return false;
  if (line.family === "pharmacy") {
    if (program.inventoryItemIds.length > 0 && !(line.inventoryItemId && program.inventoryItemIds.includes(line.inventoryItemId))) return false;
  } else if (program.actCodes.length > 0 && !(line.code && program.actCodes.includes(line.code))) {
    return false;
  }
  if (program.eligibility === "enrolment") return program.enrolled;
  if (program.minAgeMonths !== null && patient.ageMonths < program.minAgeMonths) return false;
  if (program.maxAgeMonths !== null && patient.ageMonths >= program.maxAgeMonths) return false;
  if (program.sex && program.sex !== patient.sex) return false;
  if (program.pregnantOnly && !patient.pregnant) return false;
  return true;
}

// The most generous applicable programme, ties broken by code (deterministic).
function bestProgram(programs: readonly ProgramRule[], patient: PatientProfile, line: CoverageLine): ProgramRule | null {
  let best: ProgramRule | null = null;
  for (const program of programs) {
    if (!programApplies(program, patient, line)) continue;
    if (!best || program.rate > best.rate || (program.rate === best.rate && program.code < best.code)) best = program;
  }
  return best;
}

// Shares `cap` over `values` proportionally, in whole units that add up to exactly `cap`
// (largest remainder). Values are never raised.
export function capProportionally(values: readonly number[], cap: number): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= cap) return [...values];
  if (cap <= 0 || total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v * cap) / total);
  const floored = exact.map(Math.floor);
  let left = cap - floored.reduce((s, v) => s + v, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (floored[i] < values[i]) {
      floored[i] += 1;
      left -= 1;
    }
  }
  return floored;
}

export function computeInvoiceCoverage(input: {
  lines: readonly CoverageLine[];
  patient: PatientProfile;
  programs: readonly ProgramRule[];
  coverage: CoverageTerms | null;
}): CoverageResult {
  const { lines, patient, programs, coverage } = input;
  const shares: LineShare[] = lines.map((line) => {
    if (line.amount <= 0) return { id: line.id, exemptionAmount: 0, exemptionProgramId: null, payerAmount: 0 };
    const program = bestProgram(programs, patient, line);
    const exemptionAmount = program ? Math.min(line.amount, pct(line.amount, program.rate)) : 0;
    const rest = line.amount - exemptionAmount;
    const nomenclature = coverage?.useNomenclatureRates && line.nomenclatureRate != null ? line.nomenclatureRate : null;
    const rate = coverage?.valid ? nomenclature ?? coverage.rates[line.family] ?? coverage.defaultRate : 0;
    return { id: line.id, exemptionAmount, exemptionProgramId: program && exemptionAmount > 0 ? program.id : null, payerAmount: Math.min(rest, pct(rest, rate)) };
  });

  let outcome: CoverageOutcome = !coverage ? "none" : coverage.valid ? "applied" : coverage.invalidReason === "age_limit" ? "age_limit_exceeded" : "invalid_coverage";
  const preliminary = shares.reduce((s, l) => s + l.payerAmount, 0);

  if (coverage?.valid && coverage.requiresAuthorization && preliminary > 0) {
    const needed = coverage.authorizationThreshold === null || preliminary > coverage.authorizationThreshold;
    if (needed && !coverage.authorization?.valid) {
      for (const share of shares) share.payerAmount = 0;
      outcome = "authorization_required";
    }
  }

  if (outcome === "applied") {
    const caps = [coverage!.perInvoiceCeiling, coverage!.annualRemaining, coverage!.familyRemaining ?? null, coverage!.authorization?.valid ? coverage!.authorization.remaining : null]
      .filter((c): c is number => c !== null)
      .map((c) => Math.max(0, Math.floor(c)));
    if (caps.length > 0) {
      const cap = Math.min(...caps);
      if (preliminary > cap) {
        const capped = capProportionally(shares.map((s) => s.payerAmount), cap);
        shares.forEach((s, i) => (s.payerAmount = capped[i]));
        outcome = "capped";
      }
    }
  }

  return {
    lines: shares,
    exemptionAmount: shares.reduce((s, l) => s + l.exemptionAmount, 0),
    payerAmount: shares.reduce((s, l) => s + l.payerAmount, 0),
    outcome,
  };
}

// Patient's share of an invoice: never below zero; a rejected payer share charged back to
// the patient is added.
export function patientShare(subtotal: number, payerAmount: number, exemptionAmount: number, rejectedToPatient: number): number {
  return Math.max(0, subtotal - payerAmount - exemptionAmount) + rejectedToPatient;
}
