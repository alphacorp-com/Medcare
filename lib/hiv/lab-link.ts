import type { Prisma, ScreeningTestType, StayType } from "@prisma/client";
import type { ResultParameter } from "@/lib/laboratory/results";
import type { EntryPoint, ScreeningResult } from "@/lib/hiv/input";

// Lab → screening register: when a result is validated for an exam whose catalog entry has
// a screening test type (HIV, syphilis, HBsAg…), the register gets the test, once
// (ScreeningTest.examResultId is unique). The interpretation is pure (unit-tested).

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Wordings of qualitative results, in French and English. Negative ones are checked first
// ("non réactif" contains "réactif").
const NEGATIVE = [/\bnon[\s-]*(reacti|detect)/, /\bnegati/, /\babsen/, /^-$/];
const POSITIVE = [/\breacti/, /\bpositi/, /\bdetect/, /\bpresen/, /^\+$/];
const INDETERMINATE = [/\bindetermin/, /\bdouteu/, /\bequivoq/];
const INVALID = [/\binvalid/, /\bnon interpretable/];

// The result of a qualitative test from its parameters: the first parameter whose value
// reads as a result; otherwise its flag (abnormal / high / critical = positive, normal =
// negative). null when nothing can be read: the register is then not fed automatically.
export function interpretScreeningResult(parameters: readonly ResultParameter[]): ScreeningResult | null {
  for (const p of parameters) {
    const value = normalize(p.value ?? "");
    if (!value) continue;
    if (INVALID.some((re) => re.test(value))) return "invalid";
    if (INDETERMINATE.some((re) => re.test(value))) return "indeterminate";
    if (NEGATIVE.some((re) => re.test(value))) return "negative";
    if (POSITIVE.some((re) => re.test(value))) return "positive";
  }
  const first = parameters.find((p) => (p.value ?? "").trim() !== "");
  if (!first) return null;
  if (first.flag === "abnormal" || first.flag === "high" || first.flag === "critical") return "positive";
  if (first.flag === "normal") return "negative";
  return null;
}

// Entry point of a lab-ordered test, from its context.
export function labEntryPoint(context: { pregnancyId: string | null; stayType: StayType | null }): EntryPoint {
  if (context.pregnancyId) return "antenatal";
  if (context.stayType === "emergency") return "emergency";
  if (context.stayType === "scheduled" || context.stayType === "day_care") return "inpatient";
  return "outpatient";
}

export interface LabScreeningSource {
  tenantId: string;
  examResultId: string;
  patientId: string;
  testType: ScreeningTestType;
  testedAt: Date;
  pregnancyId: string | null;
  stayType: StayType | null;
  parameters: readonly ResultParameter[];
  validatedById: string;
}

// Called inside the validation transaction. Returns false when the result can't be read
// (then nothing is recorded and the test can be entered by hand).
export async function recordScreeningFromLab(tx: Prisma.TransactionClient, source: LabScreeningSource): Promise<boolean> {
  const result = interpretScreeningResult(source.parameters);
  if (!result) return false;
  await tx.screeningTest.upsert({
    where: { examResultId: source.examResultId },
    update: {},
    create: {
      tenantId: source.tenantId,
      patientId: source.patientId,
      testType: source.testType,
      testedAt: source.testedAt,
      result,
      entryPoint: labEntryPoint(source),
      pregnancyId: source.pregnancyId,
      examResultId: source.examResultId,
      recordedById: source.validatedById,
    },
  });
  return true;
}
