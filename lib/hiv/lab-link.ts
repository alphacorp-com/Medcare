import type { Prisma, ScreeningTestType, StayType, ViralLoadProgram } from "@prisma/client";
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

// ── Viral loads from the lab ────────────────────────────────────────────────

export interface ParsedViralLoad {
  value: number | null;
  belowDetection: boolean;
}

const UNDETECTABLE = [/\bindetect/, /\bundetect/, /\bnon[\s-]*detect/, /\bnot detected\b/, /^t?nd$/, /^<\s*(ld|lod|seuil|limite)/];

// "1 250", "1.250", "1,250" (thousands) · "1,2e3", "3.4" · first number of the text.
function readNumber(text: string): number | null {
  const sci = /(\d+(?:[.,]\d+)?)\s*(?:e|x\s*10\^?)\s*(\d+)/.exec(text);
  if (sci) return Number(sci[1].replace(",", ".")) * 10 ** Number(sci[2]);
  const token = /\d[\d\s\u00a0\u202f'.,]*/.exec(text)?.[0].trim();
  if (!token) return null;
  const compact = token.replace(/[\s\u00a0\u202f']/g, "");
  // A single separator followed by exactly 3 digits is a thousands separator.
  if (/^\d{1,3}([.,]\d{3})+$/.test(compact)) return Number(compact.replace(/[.,]/g, ""));
  const n = Number(compact.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// The viral load of a lab result: below the detection threshold, or a value in copies (or
// IU)/mL — log10 results are converted back. null when nothing can be read.
export function parseViralLoadValue(parameters: readonly ResultParameter[]): ParsedViralLoad | null {
  for (const p of parameters) {
    const raw = normalize(p.value ?? "");
    if (!raw) continue;
    if (UNDETECTABLE.some((re) => re.test(raw)) || /^<\s*\d/.test(raw)) return { value: null, belowDetection: true };
    const n = readNumber(raw);
    if (n === null || n < 0) continue;
    const isLog = /\blog/.test(raw) || /\blog/.test(normalize(p.unit ?? ""));
    const value = Math.round(isLog ? 10 ** n : n);
    if (!Number.isFinite(value) || value > 2_000_000_000) continue;
    return { value, belowDetection: false };
  }
  return null;
}

export interface LabViralLoadSource {
  tenantId: string;
  examResultId: string;
  patientId: string;
  program: ViralLoadProgram;
  sampledAt: Date;
  pregnancyId: string | null;
  parameters: readonly ResultParameter[];
  validatedById: string;
}

// Called inside the validation transaction; false when the value can't be read.
export async function recordViralLoadFromLab(tx: Prisma.TransactionClient, source: LabViralLoadSource): Promise<boolean> {
  const parsed = parseViralLoadValue(source.parameters);
  if (!parsed) return false;
  const day = new Date(Date.UTC(source.sampledAt.getUTCFullYear(), source.sampledAt.getUTCMonth(), source.sampledAt.getUTCDate()));
  await tx.viralLoadResult.upsert({
    where: { examResultId: source.examResultId },
    update: {},
    create: {
      tenantId: source.tenantId,
      patientId: source.patientId,
      program: source.program,
      sampledAt: day,
      value: parsed.value,
      belowDetection: parsed.belowDetection,
      pregnancyId: source.pregnancyId,
      examResultId: source.examResultId,
      recordedById: source.validatedById,
    },
  });
  return true;
}
