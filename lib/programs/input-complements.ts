import { parseEventDate } from "@/lib/maternity/input";

// Server-side validation of the last RMA3 complements: TB screening and TB case complements,
// chronic care register, civil registration declarations, pharmacovigilance, income rubric
// of an act category. Pure, unit-tested in input-complements.test.ts.

export type ComplementInput<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): ComplementInput<T> => ({ ok: true, value });
const fail = <T>(error: string): ComplementInput<T> => ({ ok: false, error });

type Body = Record<string, unknown>;
const isBody = (b: unknown): b is Body => typeof b === "object" && b !== null && !Array.isArray(b);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);
const blank = (v: unknown) => v === undefined || v === null || v === "";

function optionalText(value: unknown, max: number): string | null | "invalid" {
  if (blank(value)) return null;
  if (typeof value !== "string" || value.trim().length > max) return "invalid";
  return value.trim() || null;
}

// An optional date after `notBefore` (null to clear when `allowClear`).
function laterDate(value: unknown, notBefore: Date, now: Date): Date | null | "invalid" {
  if (blank(value)) return null;
  const d = parseEventDate(value, now, null);
  if (d === "invalid" || d === null || d.getTime() < notBefore.getTime() - 12 * 3_600_000) return "invalid";
  return d;
}

// ── TB screening (IV.3-001 to 005) ──────────────────────────────────────────

export interface TbScreeningInput {
  patientId: string;
  screenedAt: Date;
  presumptive: boolean;
  sentToLabAt: Date | null;
  testedAt: Date | null;
  testPositive: boolean | null;
  tptStartedAt: Date | null;
  notes: string | null;
}

export function parseTbScreening(body: unknown, now = new Date()): ComplementInput<TbScreeningInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.patientId !== "string" || !UUID.test(body.patientId)) return fail("invalid_patient");
  const screenedAt = parseEventDate(body.screenedAt, now);
  if (screenedAt === "invalid" || screenedAt === null) return fail("invalid_date");
  const presumptive = body.presumptive === true;
  const sentToLabAt = laterDate(body.sentToLabAt, screenedAt, now);
  const testedAt = laterDate(body.testedAt, screenedAt, now);
  const tptStartedAt = laterDate(body.tptStartedAt, screenedAt, now);
  if (sentToLabAt === "invalid" || testedAt === "invalid" || tptStartedAt === "invalid") return fail("invalid_date");
  // Only a presumptive case is sent to the lab; a test result needs a test.
  if ((sentToLabAt || testedAt) && !presumptive) return fail("lab_needs_presumptive");
  const testPositive = body.testPositive === true ? true : body.testPositive === false ? false : null;
  if (testPositive !== null && !testedAt) return fail("result_needs_test");
  const notes = optionalText(body.notes, 1000);
  if (notes === "invalid") return fail("invalid_notes");
  return ok({ patientId: body.patientId, screenedAt, presumptive, sentToLabAt, testedAt, testPositive, tptStartedAt, notes });
}

// TB case complements (IV.3-010, 014, 015, 023), on creation and update of a case.
export interface TbCaseComplements {
  rifampicinResistant?: boolean;
  secondLineStartedAt?: Date | null;
  cotrimoxazole?: boolean;
  isHealthWorker?: boolean;
}

export function parseTbCaseComplements(body: unknown, now = new Date()): ComplementInput<TbCaseComplements> {
  if (!isBody(body)) return fail("invalid_body");
  const value: TbCaseComplements = {};
  for (const field of ["rifampicinResistant", "cotrimoxazole", "isHealthWorker"] as const) {
    if (body[field] !== undefined) value[field] = body[field] === true;
  }
  if (body.secondLineStartedAt !== undefined) {
    if (blank(body.secondLineStartedAt)) value.secondLineStartedAt = null;
    else {
      const d = parseEventDate(body.secondLineStartedAt, now, null);
      if (d === "invalid" || d === null) return fail("invalid_second_line_date");
      value.secondLineStartedAt = d;
    }
  }
  // Second-line treatment is for rifampicin-resistant TB.
  if (value.secondLineStartedAt && value.rifampicinResistant === false) return fail("second_line_needs_rr");
  return ok(value);
}

// ── Chronic care (IV.4.1, IV.4.4) ───────────────────────────────────────────

export const CHRONIC_CONDITIONS = ["diabetes", "hypertension"] as const;
export const CHRONIC_EXITS = ["lost_to_follow_up", "transferred", "died", "other"] as const;

export interface ChronicEnrolmentInput {
  patientId: string;
  condition: (typeof CHRONIC_CONDITIONS)[number];
  enrolledAt: Date;
  notes: string | null;
}

export function parseChronicEnrolment(body: unknown, now = new Date()): ComplementInput<ChronicEnrolmentInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.patientId !== "string" || !UUID.test(body.patientId)) return fail("invalid_patient");
  if (!oneOf(CHRONIC_CONDITIONS, body.condition)) return fail("invalid_condition");
  const enrolledAt = parseEventDate(body.enrolledAt, now);
  if (enrolledAt === "invalid" || enrolledAt === null) return fail("invalid_date");
  const notes = optionalText(body.notes, 1000);
  if (notes === "invalid") return fail("invalid_notes");
  return ok({ patientId: body.patientId, condition: body.condition, enrolledAt, notes });
}

export function parseChronicExit(body: unknown, enrolledAt: Date, now = new Date()): ComplementInput<{ exitedAt: Date | null; exitReason: (typeof CHRONIC_EXITS)[number] | null }> {
  if (!isBody(body)) return fail("invalid_body");
  if (blank(body.exitReason)) return ok({ exitedAt: null, exitReason: null });
  if (!oneOf(CHRONIC_EXITS, body.exitReason)) return fail("invalid_exit_reason");
  const exitedAt = laterDate(body.exitedAt ?? now.toISOString(), enrolledAt, now);
  if (exitedAt === "invalid" || exitedAt === null) return fail("invalid_exit_date");
  return ok({ exitedAt, exitReason: body.exitReason });
}

export interface ChronicVisitInput {
  visitDate: Date;
  onTreatment: boolean;
  systolic: number | null;
  diastolic: number | null;
  hba1c: number | null;
  educationIndividual: boolean;
  educationGroup: boolean;
}

function optionalNumber(value: unknown, min: number, max: number, integer: boolean): number | null | "invalid" {
  if (blank(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return "invalid";
  return n;
}

export function parseChronicVisit(body: unknown, enrolledAt: Date, now = new Date()): ComplementInput<ChronicVisitInput> {
  if (!isBody(body)) return fail("invalid_body");
  const visitDate = parseEventDate(body.visitDate, now);
  if (visitDate === "invalid" || visitDate === null || visitDate.getTime() < enrolledAt.getTime() - 12 * 3_600_000) return fail("invalid_date");
  const systolic = optionalNumber(body.systolic, 50, 300, true);
  const diastolic = optionalNumber(body.diastolic, 20, 200, true);
  if (systolic === "invalid" || diastolic === "invalid" || (systolic === null) !== (diastolic === null)) return fail("invalid_blood_pressure");
  const hba1c = optionalNumber(body.hba1c, 3, 20, false);
  if (hba1c === "invalid") return fail("invalid_hba1c");
  return ok({
    visitDate,
    onTreatment: body.onTreatment === true,
    systolic,
    diastolic,
    hba1c: hba1c === null ? null : Math.round(hba1c * 10) / 10,
    educationIndividual: body.educationIndividual === true,
    educationGroup: body.educationGroup === true,
  });
}

// ── Civil registration declarations (V.2) ───────────────────────────────────

export interface CivilDeclarationInput {
  type: "birth" | "death";
  patientId: string | null;
  personName: string;
  eventDate: Date;
  transmittedAt: Date;
  reference: string | null;
}

export function parseCivilDeclaration(body: unknown, now = new Date()): ComplementInput<CivilDeclarationInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (body.type !== "birth" && body.type !== "death") return fail("invalid_type");
  const patientId = blank(body.patientId) ? null : body.patientId;
  if (patientId !== null && (typeof patientId !== "string" || !UUID.test(patientId))) return fail("invalid_patient");
  if (typeof body.personName !== "string" || !body.personName.trim() || body.personName.trim().length > 150) return fail("invalid_name");
  const eventDate = parseEventDate(body.eventDate, now, null);
  if (eventDate === "invalid" || eventDate === null) return fail("invalid_event_date");
  const transmittedAt = laterDate(body.transmittedAt ?? now.toISOString(), eventDate, now);
  if (transmittedAt === "invalid" || transmittedAt === null) return fail("invalid_transmission_date");
  const reference = optionalText(body.reference, 80);
  if (reference === "invalid") return fail("invalid_reference");
  return ok({ type: body.type, patientId, personName: body.personName.trim(), eventDate, transmittedAt, reference });
}

// ── Pharmacovigilance (V.8) ─────────────────────────────────────────────────

export interface AdverseReactionInput {
  patientId: string;
  inventoryId: string | null;
  drugName: string;
  lotNumber: string | null;
  expiryDate: Date | null;
  reactionAt: Date;
  description: string;
  serious: boolean;
}

export function parseAdverseReaction(body: unknown, now = new Date()): ComplementInput<AdverseReactionInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.patientId !== "string" || !UUID.test(body.patientId)) return fail("invalid_patient");
  const inventoryId = blank(body.inventoryId) ? null : body.inventoryId;
  if (inventoryId !== null && (typeof inventoryId !== "string" || !UUID.test(inventoryId))) return fail("invalid_drug");
  const drugName = optionalText(body.drugName, 255);
  if (drugName === "invalid" || (drugName === null && inventoryId === null)) return fail("invalid_drug");
  const lotNumber = optionalText(body.lotNumber, 60);
  if (lotNumber === "invalid") return fail("invalid_lot");
  let expiryDate: Date | null = null;
  if (!blank(body.expiryDate)) {
    if (typeof body.expiryDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.expiryDate)) return fail("invalid_expiry");
    expiryDate = new Date(`${body.expiryDate}T00:00:00Z`);
  }
  const reactionAt = parseEventDate(body.reactionAt, now);
  if (reactionAt === "invalid" || reactionAt === null) return fail("invalid_date");
  if (typeof body.description !== "string" || body.description.trim().length < 3 || body.description.trim().length > 2000) return fail("invalid_description");
  return ok({ patientId: body.patientId, inventoryId, drugName: drugName ?? "", lotNumber, expiryDate, reactionAt, description: body.description.trim(), serious: body.serious === true });
}

export function parseInvestigation(body: unknown, reportedAt: Date, now = new Date()): ComplementInput<{ investigatedAt: Date | null; outcome: string | null }> {
  if (!isBody(body)) return fail("invalid_body");
  const investigatedAt = laterDate(body.investigatedAt, reportedAt, now);
  if (investigatedAt === "invalid") return fail("invalid_date");
  const outcome = optionalText(body.outcome, 200);
  if (outcome === "invalid") return fail("invalid_outcome");
  return ok({ investigatedAt, outcome });
}
