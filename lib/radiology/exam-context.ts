import prisma from "@/lib/prisma";
import type { ResultParameter } from "@/lib/laboratory/results";
import { findContrastAllergyMatches } from "./contrast";
import { safetyRequirements, type SafetyRequirements } from "./safety";

// What the pre-exam safety check of an imaging exam depends on: the modality and contrast of
// its catalog entry (a custom exam has neither: modality unknown, no contrast), the patient's
// sex, age and allergies, and the latest creatinine of the patient.

const CREATININE = /cr[ée]atinin/i;
// A creatinine older than this is shown, but flagged as old by the screen.
export const RECENT_CREATININE_DAYS = 90;

export interface ExamImagingContext {
  modality: string | null;
  requiresContrast: boolean;
  contrastAllergyMatches: string[];
  requirements: SafetyRequirements;
  latestCreatinine: { value: string; unit: string; at: string } | null;
}

export async function examImagingContext(
  tenantId: string | null,
  exam: { examCode: string; patientId: string },
  at: Date = new Date()
): Promise<ExamImagingContext> {
  const [entry, patient] = await Promise.all([
    prisma.examCatalogEntry.findFirst({ where: { tenantId, code: exam.examCode }, select: { imagingCatalogItemId: true, requiresContrast: true } }),
    prisma.patient.findFirst({ where: { id: exam.patientId, tenantId }, select: { gender: true, birthDate: true, allergies: true } }),
  ]);
  const modalityItem = entry?.imagingCatalogItemId
    ? await prisma.referenceCatalogItem.findFirst({ where: { id: entry.imagingCatalogItemId, tenantId }, select: { code: true } })
    : null;
  const modality = modalityItem?.code.toLowerCase() ?? null;
  const requiresContrast = entry?.requiresContrast === true;
  const allergies = Array.isArray(patient?.allergies) ? (patient!.allergies as unknown[]).filter((a): a is string => typeof a === "string") : [];
  const contrastAllergyMatches = findContrastAllergyMatches(allergies);

  return {
    modality,
    requiresContrast,
    contrastAllergyMatches,
    requirements: patient
      ? safetyRequirements({ gender: patient.gender, birthDate: patient.birthDate, at, modality, requiresContrast, contrastAllergyMatches })
      : { pregnancy: false, renal: requiresContrast, contrastAllergy: false },
    latestCreatinine: requiresContrast ? await latestCreatinine(tenantId, exam.patientId) : null,
  };
}

// The creatinine of the patient's most recent validated biology result that has one.
async function latestCreatinine(tenantId: string | null, patientId: string) {
  const results = await prisma.examResult.findMany({
    where: { tenantId, patientId, validatedAt: { not: null }, request: { type: "biology" } },
    orderBy: { validatedAt: "desc" },
    take: 30,
    select: { validatedAt: true, resultData: true },
  });
  for (const result of results) {
    const parameters = ((result.resultData ?? {}) as { parameters?: ResultParameter[] }).parameters ?? [];
    const creatinine = parameters.find((p) => CREATININE.test(p?.name ?? "") && String(p?.value ?? "").trim());
    if (creatinine) return { value: String(creatinine.value), unit: creatinine.unit ?? "", at: result.validatedAt!.toISOString() };
  }
  return null;
}
