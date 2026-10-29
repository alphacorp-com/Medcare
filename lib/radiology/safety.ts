// Pre-exam safety of an imaging exam and radiation dose of its report. Pure, unit-tested in
// safety.test.ts.
//
// Before an exam starts (patient on the table), the technologist records:
//   - pregnancy: for a woman of childbearing age (10–55 years) and an ionizing modality — not
//     pregnant, or pregnant / unknown with the justification of the exam;
//   - renal function: for an exam with contrast — assessed, with the creatinine / eGFR if known;
//   - contrast allergy: acknowledged when the patient's allergies mention one.

// Imaging modalities (ReferenceCatalogItem codes of type imaging_type) that do NOT use ionizing
// radiation. Anything else — and a custom exam whose modality is unknown — is treated as
// ionizing: asking the pregnancy question once too often is safer than missing it.
const NON_IONIZING_MODALITIES = new Set(["echo", "echo_cardiac", "mri", "ecg", "ultrasound", "doppler"]);

export function isIonizingModality(modality: string | null | undefined): boolean {
  return !NON_IONIZING_MODALITIES.has((modality ?? "").toLowerCase());
}

export const CHILDBEARING_AGE = { min: 10, max: 55 };

export function ageInYears(birthDate: Date, at: Date): number {
  let years = at.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday = at.getUTCMonth() < birthDate.getUTCMonth() || (at.getUTCMonth() === birthDate.getUTCMonth() && at.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

export interface SafetyRequirements {
  pregnancy: boolean;
  renal: boolean;
  contrastAllergy: boolean;
}

export function safetyRequirements(input: {
  gender: string;
  birthDate: Date;
  at: Date;
  modality: string | null;
  requiresContrast: boolean;
  contrastAllergyMatches: readonly string[];
}): SafetyRequirements {
  const age = ageInYears(input.birthDate, input.at);
  return {
    pregnancy: input.gender === "F" && age >= CHILDBEARING_AGE.min && age <= CHILDBEARING_AGE.max && isIonizingModality(input.modality),
    renal: input.requiresContrast,
    contrastAllergy: input.requiresContrast && input.contrastAllergyMatches.length > 0,
  };
}

export const PREGNANCY_STATUSES = ["not_pregnant", "pregnant", "unknown"] as const;
export type PregnancyStatus = (typeof PREGNANCY_STATUSES)[number];

export interface SafetyCheck {
  pregnancy?: { status: PregnancyStatus; justification: string | null };
  renal?: { assessed: true; creatinineUmolL: number | null; egfr: number | null };
  contrastAllergyAcknowledged?: boolean;
  checkedBy: string;
  checkedAt: string;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const optionalNumber = (raw: unknown, min: number, max: number): number | null | undefined => {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

// Only the answers the requirements ask for are kept; a missing one is an error.
export function parseSafetyCheck(raw: Record<string, unknown> | null | undefined, required: SafetyRequirements, actor: { userId: string; at: Date }): Parsed<SafetyCheck> {
  const body = raw ?? {};
  const check: SafetyCheck = { checkedBy: actor.userId, checkedAt: actor.at.toISOString() };

  if (required.pregnancy) {
    const p = (body.pregnancy ?? {}) as { status?: unknown; justification?: unknown };
    if (!(PREGNANCY_STATUSES as readonly unknown[]).includes(p.status)) return { ok: false, error: "pregnancy_status_required" };
    const justification = typeof p.justification === "string" ? p.justification.trim() : "";
    if (justification.length > 2_000) return { ok: false, error: "pregnancy_justification_too_long" };
    // Irradiating a (possibly) pregnant woman needs the reason written down.
    if (p.status !== "not_pregnant" && justification.length < 5) return { ok: false, error: "pregnancy_justification_required" };
    check.pregnancy = { status: p.status as PregnancyStatus, justification: justification || null };
  }

  if (required.renal) {
    const r = (body.renal ?? {}) as { assessed?: unknown; creatinineUmolL?: unknown; egfr?: unknown };
    if (r.assessed !== true) return { ok: false, error: "renal_assessment_required" };
    const creatinineUmolL = optionalNumber(r.creatinineUmolL, 1, 5_000);
    const egfr = optionalNumber(r.egfr, 1, 250);
    if (creatinineUmolL === undefined || egfr === undefined) return { ok: false, error: "renal_values_invalid" };
    check.renal = { assessed: true, creatinineUmolL, egfr };
  }

  if (required.contrastAllergy) {
    if (body.contrastAllergyAcknowledged !== true) return { ok: false, error: "contrast_allergy_acknowledgement_required" };
    check.contrastAllergyAcknowledged = true;
  }
  return { ok: true, value: check };
}

// ── Radiation dose (in the report) ──────────────────────────────────────────

export interface RadiationDose {
  // Dose–area product, mGy·cm² (radiography, fluoroscopy).
  dapMgyCm2: number | null;
  // CT: volume CT dose index (mGy) and dose–length product (mGy·cm).
  ctdiVolMgy: number | null;
  dlpMgyCm: number | null;
  // Fluoroscopy time, seconds.
  fluoroscopySeconds: number | null;
}

// All optional (not every device displays them); null when nothing was given.
export function parseRadiationDose(raw: unknown): Parsed<RadiationDose | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "object") return { ok: false, error: "radiationDose must be an object" };
  const r = raw as Record<string, unknown>;
  const dose: RadiationDose = {
    dapMgyCm2: optionalNumber(r.dapMgyCm2, 0, 1_000_000) as number | null,
    ctdiVolMgy: optionalNumber(r.ctdiVolMgy, 0, 1_000) as number | null,
    dlpMgyCm: optionalNumber(r.dlpMgyCm, 0, 100_000) as number | null,
    fluoroscopySeconds: optionalNumber(r.fluoroscopySeconds, 0, 36_000) as number | null,
  };
  if (Object.entries(dose).some(([key, value]) => value === undefined && r[key] !== undefined && r[key] !== null && r[key] !== "")) {
    return { ok: false, error: "radiationDose has an invalid value" };
  }
  return { ok: true, value: Object.values(dose).every((v) => v === null || v === undefined) ? null : dose };
}

// ── Accession number and PACS viewer link ───────────────────────────────────

// "A2611051234567": A + yymmdd + 7 random digits. Unique per facility (index); the caller
// retries on the rare collision.
export function newAccessionNumber(at: Date, random: () => number = Math.random): string {
  const yymmdd = `${String(at.getUTCFullYear()).slice(2)}${String(at.getUTCMonth() + 1).padStart(2, "0")}${String(at.getUTCDate()).padStart(2, "0")}`;
  const digits = String(Math.floor(random() * 10_000_000)).padStart(7, "0");
  return `A${yymmdd}${digits}`;
}

// The facility's PACS viewer URL with "{accession}" in it, e.g.
// https://pacs.local/ohif/viewer?AccessionNumber={accession}. Must be http(s).
export function isValidViewerTemplate(template: string): boolean {
  if (!template.includes("{accession}") || template.length > 500) return false;
  try {
    const url = new URL(template.replace("{accession}", "A0"));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function viewerUrl(template: string | null | undefined, accessionNumber: string | null | undefined): string | null {
  if (!template || !accessionNumber || !isValidViewerTemplate(template)) return null;
  return template.replace("{accession}", encodeURIComponent(accessionNumber));
}
