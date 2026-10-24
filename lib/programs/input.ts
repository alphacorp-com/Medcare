import { parseEventDate } from "@/lib/maternity/input";

// Server-side validation of the malaria complements, hypoxaemia episodes, biomedical
// equipment, acute malnutrition cases and growth monitoring visits. Pure, unit-tested in
// input.test.ts. Errors are codes, translated by the pages.

export type ProgramInput<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): ProgramInput<T> => ({ ok: true, value });
const fail = <T>(error: string): ProgramInput<T> => ({ ok: false, error });

type Body = Record<string, unknown>;
const isBody = (b: unknown): b is Body => typeof b === "object" && b !== null && !Array.isArray(b);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);

function optionalNumber(value: unknown, min: number, max: number, integer = false): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return "invalid";
  return n;
}

function optionalText(value: unknown, max: number): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim().length > max) return "invalid";
  return value.trim() || null;
}

// A yes / no / not asked answer.
function optionalBool(value: unknown): boolean | null {
  return value === true ? true : value === false ? false : null;
}

// ── Malaria complements (RMA3 IV.2.4-5) ─────────────────────────────────────

export const MALARIA_SPECIES = ["falciparum", "mixed", "vivax", "malariae", "ovale", "other"] as const;
export const MALARIA_TREATMENTS = ["asaq", "al", "dhap", "other_act", "quinine_oral", "artesunate_inj", "artemether_inj", "quinine_inj"] as const;
export const ACT_TREATMENTS: ReadonlySet<string> = new Set(["asaq", "al", "dhap", "other_act"]);
export const INJECTABLE_TREATMENTS: ReadonlySet<string> = new Set(["artesunate_inj", "artemether_inj", "quinine_inj"]);

export interface MalariaComplements {
  species: (typeof MALARIA_SPECIES)[number] | null;
  treatment: (typeof MALARIA_TREATMENTS)[number] | null;
  hospitalized: boolean;
  freeOfCharge: boolean;
}

// `result`: the test result of the case — a species only makes sense for a positive test.
export function parseMalariaComplements(body: unknown, result: string | undefined): ProgramInput<MalariaComplements> {
  if (!isBody(body)) return fail("invalid_body");
  const species = body.species === undefined || body.species === null || body.species === "" ? null : body.species;
  if (species !== null && !oneOf(MALARIA_SPECIES, species)) return fail("invalid_species");
  if (species !== null && result !== "positive") return fail("species_needs_positive");
  const treatment = body.treatment === undefined || body.treatment === null || body.treatment === "" ? null : body.treatment;
  if (treatment !== null && !oneOf(MALARIA_TREATMENTS, treatment)) return fail("invalid_treatment");
  return ok({ species, treatment, hospitalized: body.hospitalized === true, freeOfCharge: body.freeOfCharge === true });
}

// ── Biomedical equipment (RMA3 V.9) ─────────────────────────────────────────

export const EQUIPMENT_TYPES = ["pulse_oximeter", "oxygen_concentrator", "ventilator", "oxygen_cylinder_7500", "other"] as const;
export const EQUIPMENT_STATUSES = ["functional", "broken", "maintenance", "retired"] as const;

export interface EquipmentInput {
  code: string;
  type: (typeof EQUIPMENT_TYPES)[number];
  label: string;
  serialNumber: string | null;
  location: string | null;
  status: (typeof EQUIPMENT_STATUSES)[number];
}

export function parseEquipment(body: unknown, { partial }: { partial: boolean }): ProgramInput<Partial<EquipmentInput>> {
  if (!isBody(body)) return fail("invalid_body");
  const has = (k: string) => !partial || body[k] !== undefined;
  const value: Partial<EquipmentInput> = {};
  if (has("code")) {
    if (typeof body.code !== "string" || !/^[A-Za-z0-9._-]{1,40}$/.test(body.code.trim())) return fail("invalid_code");
    value.code = body.code.trim().toUpperCase();
  }
  if (has("type")) {
    if (!oneOf(EQUIPMENT_TYPES, body.type)) return fail("invalid_type");
    value.type = body.type;
  }
  if (has("label")) {
    if (typeof body.label !== "string" || !body.label.trim() || body.label.trim().length > 150) return fail("invalid_label");
    value.label = body.label.trim();
  }
  for (const [field, max] of [["serialNumber", 80], ["location", 150]] as const) {
    if (!has(field)) continue;
    const text = optionalText(body[field], max);
    if (text === "invalid") return fail(`invalid_${field}`);
    value[field] = text;
  }
  if (has("status")) {
    const status = body.status ?? "functional";
    if (!oneOf(EQUIPMENT_STATUSES, status)) return fail("invalid_status");
    value.status = status;
  }
  return ok(value);
}

// ── Hypoxaemia episodes (RMA3 V.9) ──────────────────────────────────────────

export const HYPOXEMIA_OUTCOMES = ["cured", "referred", "left_against_advice", "died"] as const;

export interface HypoxemiaInput {
  patientId: string;
  detectedAt: Date;
  spo2: number | null;
  respiratoryDistress: boolean;
  deliveryRoom: boolean;
  oxygenGiven: boolean;
  notes: string | null;
}

export function parseHypoxemiaEpisode(body: unknown, now = new Date()): ProgramInput<HypoxemiaInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.patientId !== "string" || !UUID.test(body.patientId)) return fail("invalid_patient");
  const detectedAt = parseEventDate(body.detectedAt, now);
  if (detectedAt === "invalid" || detectedAt === null) return fail("invalid_date");
  const spo2 = optionalNumber(body.spo2, 30, 100, true);
  if (spo2 === "invalid") return fail("invalid_spo2");
  const respiratoryDistress = body.respiratoryDistress === true;
  // An episode is a hypoxaemia (SpO2 < 90 %) or a respiratory distress.
  if ((spo2 === null || spo2 >= 90) && !respiratoryDistress) return fail("not_hypoxemia");
  const notes = optionalText(body.notes, 1000);
  if (notes === "invalid") return fail("invalid_notes");
  return ok({
    patientId: body.patientId,
    detectedAt,
    spo2,
    respiratoryDistress,
    deliveryRoom: body.deliveryRoom === true,
    oxygenGiven: body.oxygenGiven === true,
    notes,
  });
}

export interface HypoxemiaOutcomeInput {
  oxygenGiven?: boolean;
  outcome?: (typeof HYPOXEMIA_OUTCOMES)[number] | null;
  outcomeAt?: Date | null;
}

export function parseHypoxemiaOutcome(body: unknown, detectedAt: Date, now = new Date()): ProgramInput<HypoxemiaOutcomeInput> {
  if (!isBody(body)) return fail("invalid_body");
  const value: HypoxemiaOutcomeInput = {};
  if (body.oxygenGiven !== undefined) value.oxygenGiven = body.oxygenGiven === true;
  if (body.outcome !== undefined) {
    if (body.outcome === null || body.outcome === "") {
      value.outcome = null;
      value.outcomeAt = null;
    } else {
      if (!oneOf(HYPOXEMIA_OUTCOMES, body.outcome)) return fail("invalid_outcome");
      const at = parseEventDate(body.outcomeAt, now);
      if (at === "invalid" || at === null || at < detectedAt) return fail("invalid_outcome_date");
      value.outcome = body.outcome;
      value.outcomeAt = at;
    }
  }
  return ok(value);
}

// ── Acute malnutrition cases (PCIMA, RMA3 IV.6) ─────────────────────────────

export const NUTRITION_PROGRAMS = ["cna", "cnti"] as const;
export const NUTRITION_ADMISSIONS = ["new_case", "relapse", "readmission_after_default", "transfer_in"] as const;
export const NUTRITION_CRITERIA = ["whz", "muac", "oedema"] as const;
export const NUTRITION_RESIDENCIES = ["resident", "displaced", "refugee"] as const;
export const NUTRITION_EXITS = ["cured", "defaulted", "died", "non_responder", "transfer_out"] as const;

export interface NutritionAdmissionInput {
  patientId: string;
  program: (typeof NUTRITION_PROGRAMS)[number];
  admittedAt: Date;
  admissionType: (typeof NUTRITION_ADMISSIONS)[number];
  criterion: (typeof NUTRITION_CRITERIA)[number] | null;
  muacMm: number | null;
  whz: number | null;
  residency: (typeof NUTRITION_RESIDENCIES)[number];
  hivTested: boolean;
  anjeCounseling: boolean;
  notes: string | null;
}

export function parseNutritionAdmission(body: unknown, now = new Date()): ProgramInput<NutritionAdmissionInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.patientId !== "string" || !UUID.test(body.patientId)) return fail("invalid_patient");
  if (!oneOf(NUTRITION_PROGRAMS, body.program)) return fail("invalid_program");
  const admittedAt = parseEventDate(body.admittedAt, now);
  if (admittedAt === "invalid" || admittedAt === null) return fail("invalid_date");
  if (!oneOf(NUTRITION_ADMISSIONS, body.admissionType)) return fail("invalid_admission_type");
  const criterion = body.criterion === undefined || body.criterion === null || body.criterion === "" ? null : body.criterion;
  if (criterion !== null && !oneOf(NUTRITION_CRITERIA, criterion)) return fail("invalid_criterion");
  const muacMm = optionalNumber(body.muacMm, 50, 400, true);
  if (muacMm === "invalid") return fail("invalid_muac");
  const whz = optionalNumber(body.whz, -10, 10);
  if (whz === "invalid") return fail("invalid_whz");
  const residency = body.residency ?? "resident";
  if (!oneOf(NUTRITION_RESIDENCIES, residency)) return fail("invalid_residency");
  const notes = optionalText(body.notes, 1000);
  if (notes === "invalid") return fail("invalid_notes");
  return ok({
    patientId: body.patientId,
    program: body.program,
    admittedAt,
    admissionType: body.admissionType,
    criterion,
    muacMm,
    whz: whz === null ? null : Math.round(whz * 10) / 10,
    residency,
    hivTested: body.hivTested === true,
    anjeCounseling: body.anjeCounseling === true,
    notes,
  });
}

export interface NutritionUpdateInput {
  hivTested?: boolean;
  anjeCounseling?: boolean;
  exit?: { exitedAt: Date; exitReason: (typeof NUTRITION_EXITS)[number] } | null;
}

export function parseNutritionUpdate(body: unknown, admittedAt: Date, now = new Date()): ProgramInput<NutritionUpdateInput> {
  if (!isBody(body)) return fail("invalid_body");
  const value: NutritionUpdateInput = {};
  if (body.hivTested !== undefined) value.hivTested = body.hivTested === true;
  if (body.anjeCounseling !== undefined) value.anjeCounseling = body.anjeCounseling === true;
  if (body.exitReason !== undefined) {
    if (body.exitReason === null || body.exitReason === "") value.exit = null;
    else {
      if (!oneOf(NUTRITION_EXITS, body.exitReason)) return fail("invalid_exit_reason");
      const exitedAt = parseEventDate(body.exitedAt, now);
      if (exitedAt === "invalid" || exitedAt === null || exitedAt < admittedAt) return fail("invalid_exit_date");
      value.exit = { exitedAt, exitReason: body.exitReason };
    }
  }
  return ok(value);
}

// ── Growth monitoring visits (RMA3 III.9) ───────────────────────────────────

export interface GrowthVisitInput {
  patientId: string;
  visitDate: Date;
  weightKg: number | null;
  heightCm: number | null;
  muacMm: number | null;
  counseling: boolean;
  exclusiveBreastfeeding: boolean | null;
  receivesWater: boolean | null;
  complementaryFood: boolean | null;
  stillBreastfed: boolean | null;
  multivitaminGiven: boolean;
}

export function parseGrowthVisit(body: unknown, now = new Date()): ProgramInput<GrowthVisitInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.patientId !== "string" || !UUID.test(body.patientId)) return fail("invalid_patient");
  const visitDate = parseEventDate(body.visitDate, now);
  if (visitDate === "invalid" || visitDate === null) return fail("invalid_date");
  const weightKg = optionalNumber(body.weightKg, 0.3, 60);
  if (weightKg === "invalid") return fail("invalid_weight");
  const heightCm = optionalNumber(body.heightCm, 20, 160);
  if (heightCm === "invalid") return fail("invalid_height");
  const muacMm = optionalNumber(body.muacMm, 50, 400, true);
  if (muacMm === "invalid") return fail("invalid_muac");
  return ok({
    patientId: body.patientId,
    visitDate,
    weightKg,
    heightCm,
    muacMm,
    counseling: body.counseling === true,
    exclusiveBreastfeeding: optionalBool(body.exclusiveBreastfeeding),
    receivesWater: optionalBool(body.receivesWater),
    complementaryFood: optionalBool(body.complementaryFood),
    stillBreastfed: optionalBool(body.stillBreastfed),
    multivitaminGiven: body.multivitaminGiven === true,
  });
}
