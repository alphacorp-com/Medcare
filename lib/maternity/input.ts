import { FEMALE_ONLY_METHODS, FP_METHODS_BY_CODE, MALE_ONLY_METHODS, PROCEDURE_METHOD } from "@/lib/family-planning/methods";

// Server-side validation of the mother-and-child records (antenatal visit extras, delivery,
// newborn, pregnancy outcome, post-natal visit, family planning). Pure, unit-tested in
// input.test.ts. Errors are codes, translated by the pages.

export type MaternityInput<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): MaternityInput<T> => ({ ok: true, value });
const fail = <T>(error: string): MaternityInput<T> => ({ ok: false, error });

const DAY = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = Record<string, unknown>;
const isBody = (b: unknown): b is Body => typeof b === "object" && b !== null && !Array.isArray(b);
const bool = (v: unknown) => v === true;

// A date ("YYYY-MM-DD", noon UTC) or a date-time; absent → `fallback`. Never in the future
// (5 min of clock skew tolerated).
export function parseEventDate(value: unknown, now: Date, fallback: Date | null = now): Date | null | "invalid" {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return "invalid";
  const at = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(at.getTime()) || at.getTime() > now.getTime() + 5 * 60_000) return "invalid";
  return at;
}

function optionalText(value: unknown, max: number): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim().length > max) return "invalid";
  return value.trim() || null;
}

// ── Antenatal visit: outreach, haemoglobin, Td dose ─────────────────────────

export interface AntenatalExtras {
  strategy: "fixed" | "outreach";
  hemoglobinGPerDl: number | null;
  td: { doseNumber: number; stockLotId: string | null; lotNumber: string | null } | null;
}

export function parseAntenatalExtras(body: unknown): MaternityInput<AntenatalExtras> {
  if (!isBody(body)) return fail("invalid_body");
  const strategy = body.strategy ?? "fixed";
  if (strategy !== "fixed" && strategy !== "outreach") return fail("invalid_strategy");

  let hemoglobinGPerDl: number | null = null;
  if (body.hemoglobinGPerDl !== undefined && body.hemoglobinGPerDl !== null && body.hemoglobinGPerDl !== "") {
    const hb = Number(body.hemoglobinGPerDl);
    if (!Number.isFinite(hb) || hb < 2 || hb > 25) return fail("invalid_hemoglobin");
    hemoglobinGPerDl = Math.round(hb * 10) / 10;
  }

  let td: AntenatalExtras["td"] = null;
  if (body.td !== undefined && body.td !== null) {
    if (!isBody(body.td)) return fail("invalid_td");
    const { doseNumber, stockLotId, lotNumber } = body.td;
    if (typeof doseNumber !== "number" || !Number.isInteger(doseNumber) || doseNumber < 1 || doseNumber > 5) return fail("invalid_td_dose");
    if (stockLotId !== undefined && stockLotId !== null && stockLotId !== "" && (typeof stockLotId !== "string" || !UUID.test(stockLotId))) return fail("invalid_td");
    const lot = optionalText(lotNumber, 60);
    if (lot === "invalid") return fail("invalid_td");
    td = { doseNumber, stockLotId: typeof stockLotId === "string" && stockLotId ? stockLotId : null, lotNumber: lot };
  }
  return ok({ strategy, hemoglobinGPerDl, td });
}

// ── Delivery ────────────────────────────────────────────────────────────────

// RMA3 II.1.2 nomenclature ("eclampsia" covers pre-eclampsia / eclampsia: the value already
// stored by earlier versions is kept).
export const DELIVERY_COMPLICATIONS = [
  "postpartum_hemorrhage",
  "obstructed_labour",
  "eclampsia",
  "uterine_rupture",
  "puerperal_infection",
  "perineal_tear",
  "none",
] as const;

export const BREASTFEEDING_STARTS = ["within_30_min", "within_1_hour", "later", "not_started"] as const;

export interface DeliveryExtras {
  complications: string[];
  amtsl: boolean;
  complicationsManaged: boolean;
  breastfeedingStart: (typeof BREASTFEEDING_STARTS)[number] | null;
}

export function parseDeliveryExtras(body: unknown): MaternityInput<DeliveryExtras> {
  if (!isBody(body)) return fail("invalid_body");
  const raw = body.complications ?? [];
  if (!Array.isArray(raw) || !raw.every((c) => typeof c === "string" && (DELIVERY_COMPLICATIONS as readonly string[]).includes(c))) return fail("invalid_complications");
  const complications = [...new Set(raw as string[])];
  if (complications.includes("none") && complications.length > 1) return fail("invalid_complications");
  const real = complications.filter((c) => c !== "none");

  const start = body.breastfeedingStart ?? null;
  if (start !== null && !(BREASTFEEDING_STARTS as readonly unknown[]).includes(start)) return fail("invalid_breastfeeding");
  return ok({
    complications,
    amtsl: bool(body.amtsl),
    // "Managed" only makes sense when there was a complication.
    complicationsManaged: real.length > 0 && bool(body.complicationsManaged),
    breastfeedingStart: start as DeliveryExtras["breastfeedingStart"],
  });
}

// ── Newborn ─────────────────────────────────────────────────────────────────

export const NEWBORN_OUTCOMES = ["alive", "stillbirth", "neonatal_death"] as const;
export const NEONATAL_DEATH_CAUSES = ["prematurity", "asphyxia", "infection", "other"] as const;
type DeathCause = (typeof NEONATAL_DEATH_CAUSES)[number];

export interface NewbornExtras {
  outcome: (typeof NEWBORN_OUTCOMES)[number];
  stillbirthType: "fresh" | "macerated" | null;
  bagMaskVentilation: boolean;
  diedAt: Date | null;
  deathCause: DeathCause | null;
}

// `birthAt`: the delivery date. A neonatal death is within 28 days of the birth.
export function parseNewbornExtras(body: unknown, birthAt: Date, now = new Date()): MaternityInput<NewbornExtras> {
  if (!isBody(body)) return fail("invalid_body");
  const outcome = body.outcome ?? "alive";
  if (!(NEWBORN_OUTCOMES as readonly unknown[]).includes(outcome)) return fail("invalid_outcome");

  let stillbirthType: NewbornExtras["stillbirthType"] = null;
  if (outcome === "stillbirth") {
    if (body.stillbirthType !== "fresh" && body.stillbirthType !== "macerated") return fail("invalid_stillbirth_type");
    stillbirthType = body.stillbirthType;
  }

  let diedAt: Date | null = null;
  let deathCause: DeathCause | null = null;
  if (outcome === "neonatal_death") {
    const death = parseNeonatalDeath(body, birthAt, now);
    if (!death.ok) return death;
    ({ diedAt, deathCause } = death.value);
  }
  return ok({ outcome: outcome as NewbornExtras["outcome"], stillbirthType, bagMaskVentilation: bool(body.bagMaskVentilation), diedAt, deathCause });
}

function parseNeonatalDeath(body: Body, birthAt: Date, now: Date): MaternityInput<{ diedAt: Date; deathCause: DeathCause | null }> {
  const diedAt = parseEventDate(body.diedAt, now, null);
  if (diedAt === "invalid" || diedAt === null) return fail("invalid_death_date");
  // A date without time is noon: the day of birth stays valid.
  if (diedAt.getTime() < birthAt.getTime() - DAY / 2 || diedAt.getTime() > birthAt.getTime() + 28 * DAY) return fail("invalid_death_date");
  const cause = body.deathCause ?? null;
  if (cause !== null && !(NEONATAL_DEATH_CAUSES as readonly unknown[]).includes(cause)) return fail("invalid_death_cause");
  return ok({ diedAt: new Date(Math.max(diedAt.getTime(), birthAt.getTime())), deathCause: cause as DeathCause | null });
}

export interface NewbornUpdate {
  kangarooCare?: boolean;
  incubatorCare?: boolean;
  death?: { diedAt: Date; deathCause: DeathCause | null } | null;
  deathReviewedAt?: Date | null;
}

// Follow-up of a newborn after its registration: neonatal care, death, death review.
export function parseNewbornUpdate(body: unknown, birthAt: Date, current: { diedAt: Date | null; outcome: string }, now = new Date()): MaternityInput<NewbornUpdate> {
  if (!isBody(body)) return fail("invalid_body");
  const update: NewbornUpdate = {};
  if (body.kangarooCare !== undefined) update.kangarooCare = bool(body.kangarooCare);
  if (body.incubatorCare !== undefined) update.incubatorCare = bool(body.incubatorCare);
  if (body.died !== undefined) {
    if (current.outcome === "stillbirth") return fail("invalid_outcome");
    if (body.died === true) {
      const death = parseNeonatalDeath(body, birthAt, now);
      if (!death.ok) return death;
      update.death = death.value;
    } else {
      update.death = null;
    }
  }
  if (body.deathReviewedAt !== undefined) {
    const diedAt = update.death === undefined ? current.diedAt : update.death?.diedAt ?? null;
    if (body.deathReviewedAt === null || body.deathReviewedAt === "") update.deathReviewedAt = null;
    else {
      const reviewed = parseEventDate(body.deathReviewedAt, now, null);
      if (reviewed === "invalid" || reviewed === null || !diedAt || reviewed.getTime() < diedAt.getTime() - DAY) return fail("invalid_review_date");
      update.deathReviewedAt = reviewed;
    }
  }
  return ok(update);
}

// ── Pregnancy outcome: abortion care, maternal death ────────────────────────

export const MATERNAL_DEATH_CAUSES = ["hemorrhage", "obstructed_labour", "preeclampsia_eclampsia", "uterine_rupture", "puerperal_infection", "abortion", "other"] as const;

export interface PregnancyOutcome {
  status?: "ongoing" | "miscarried" | "terminated";
  endedAt?: Date | null;
  abortionCare?: "uncomplicated" | "complicated" | null;
  maternalDeath?: { at: Date; cause: (typeof MATERNAL_DEATH_CAUSES)[number]; reviewedAt: Date | null } | null;
  notes?: string | null;
}

export function parsePregnancyOutcome(
  body: unknown,
  pregnancy: { lastMenstrualPeriod: Date; status: string; hasDelivery: boolean },
  now = new Date()
): MaternityInput<PregnancyOutcome> {
  if (!isBody(body)) return fail("invalid_body");
  const result: PregnancyOutcome = {};

  if (body.notes !== undefined) {
    const notes = optionalText(body.notes, 2000);
    if (notes === "invalid") return fail("invalid_notes");
    result.notes = notes;
  }

  if (body.status !== undefined) {
    // "delivered" is set by the delivery itself, never by hand.
    if (body.status !== "ongoing" && body.status !== "miscarried" && body.status !== "terminated") return fail("invalid_status");
    if (pregnancy.hasDelivery) return fail("pregnancy_delivered");
    result.status = body.status;
    if (body.status === "ongoing") {
      result.endedAt = null;
      result.abortionCare = null;
    } else {
      const endedAt = parseEventDate(body.endedAt, now, null);
      if (endedAt === "invalid" || endedAt === null || endedAt < pregnancy.lastMenstrualPeriod) return fail("invalid_end_date");
      result.endedAt = endedAt;
      const care = body.abortionCare ?? null;
      if (care !== null && care !== "uncomplicated" && care !== "complicated") return fail("invalid_abortion_care");
      result.abortionCare = care as PregnancyOutcome["abortionCare"];
    }
  }

  if (body.maternalDeath !== undefined) {
    if (body.maternalDeath === null) result.maternalDeath = null;
    else {
      if (!isBody(body.maternalDeath)) return fail("invalid_maternal_death");
      const { at, cause, reviewedAt } = body.maternalDeath;
      const deathAt = parseEventDate(at, now, null);
      if (deathAt === "invalid" || deathAt === null || deathAt < pregnancy.lastMenstrualPeriod) return fail("invalid_maternal_death");
      if (!(MATERNAL_DEATH_CAUSES as readonly unknown[]).includes(cause)) return fail("invalid_maternal_death_cause");
      let reviewed: Date | null = null;
      if (reviewedAt !== undefined && reviewedAt !== null && reviewedAt !== "") {
        const r = parseEventDate(reviewedAt, now, null);
        if (r === "invalid" || r === null || r.getTime() < deathAt.getTime() - DAY) return fail("invalid_review_date");
        reviewed = r;
      }
      result.maternalDeath = { at: deathAt, cause: cause as (typeof MATERNAL_DEATH_CAUSES)[number], reviewedAt: reviewed };
    }
  }
  return ok(result);
}

// ── Post-natal visit ────────────────────────────────────────────────────────

export interface PostnatalVisitInput {
  visitDate: Date;
  vitaminAGiven: boolean;
  ironFolateGiven: boolean;
  breastfeedingCounseling: boolean;
  newbornExamined: boolean;
  notes: string | null;
}

// Between the delivery and 90 days after it (the RMA3 counts up to 6 weeks).
export function parsePostnatalVisit(body: unknown, deliveryAt: Date, now = new Date()): MaternityInput<PostnatalVisitInput> {
  if (!isBody(body)) return fail("invalid_body");
  const visitDate = parseEventDate(body.visitDate, now);
  if (visitDate === "invalid" || visitDate === null) return fail("invalid_date");
  if (visitDate.getTime() < deliveryAt.getTime() - DAY / 2 || visitDate.getTime() > deliveryAt.getTime() + 90 * DAY) return fail("invalid_postnatal_date");
  const notes = optionalText(body.notes, 2000);
  if (notes === "invalid") return fail("invalid_notes");
  return ok({
    visitDate: new Date(Math.max(visitDate.getTime(), deliveryAt.getTime())),
    vitaminAGiven: bool(body.vitaminAGiven),
    ironFolateGiven: bool(body.ironFolateGiven),
    breastfeedingCounseling: bool(body.breastfeedingCounseling),
    newbornExamined: bool(body.newbornExamined),
    notes,
  });
}

// ── Family planning visit ───────────────────────────────────────────────────

export const FP_PROCEDURES = ["implant_insertion", "implant_removal", "iud_insertion", "iud_removal"] as const;

export interface FpVisitInput {
  patientId: string;
  visitDate: Date;
  clientStatus: "new_user" | "continuing_user";
  counseled: boolean;
  methodCode: string | null;
  procedure: (typeof FP_PROCEDURES)[number] | null;
  isPostpartum: boolean;
  referredByChw: boolean;
  contraindications: string | null;
  sideEffects: string | null;
  nextDueDate: Date | null;
  notes: string | null;
}

// `gender`: of the patient (M / F / U) — a method of the other sex is refused.
export function parseFpVisit(body: unknown, gender: string, now = new Date()): MaternityInput<FpVisitInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.patientId !== "string" || !UUID.test(body.patientId)) return fail("invalid_patient");
  const visitDate = parseEventDate(body.visitDate, now);
  if (visitDate === "invalid" || visitDate === null) return fail("invalid_date");
  if (body.clientStatus !== "new_user" && body.clientStatus !== "continuing_user") return fail("invalid_client_status");

  const methodCode = body.methodCode === undefined || body.methodCode === null || body.methodCode === "" ? null : body.methodCode;
  if (methodCode !== null && (typeof methodCode !== "string" || !FP_METHODS_BY_CODE.has(methodCode))) return fail("invalid_method");
  if (methodCode && gender === "M" && FEMALE_ONLY_METHODS.has(methodCode)) return fail("method_sex_mismatch");
  if (methodCode && gender === "F" && MALE_ONLY_METHODS.has(methodCode)) return fail("method_sex_mismatch");

  const procedure = body.procedure === undefined || body.procedure === null || body.procedure === "" ? null : body.procedure;
  if (procedure !== null && !(FP_PROCEDURES as readonly unknown[]).includes(procedure)) return fail("invalid_procedure");
  // An insertion goes with its method; a removal may end the method (no method) or switch.
  if (procedure === "implant_insertion" || procedure === "iud_insertion") {
    if (methodCode !== PROCEDURE_METHOD[procedure]) return fail("procedure_method_mismatch");
  }
  if (procedure !== null && gender === "M") return fail("method_sex_mismatch");

  const isPostpartum = bool(body.isPostpartum);
  if (isPostpartum && gender === "M") return fail("invalid_postpartum");
  if (isPostpartum && methodCode && !FP_METHODS_BY_CODE.get(methodCode)!.postpartum) return fail("method_not_postpartum");

  const texts: Record<"contraindications" | "sideEffects" | "notes", string | null> = { contraindications: null, sideEffects: null, notes: null };
  for (const field of ["contraindications", "sideEffects", "notes"] as const) {
    const value = optionalText(body[field], 1000);
    if (value === "invalid") return fail(`invalid_${field}`);
    texts[field] = value;
  }

  let nextDueDate: Date | null = null;
  if (body.nextDueDate !== undefined && body.nextDueDate !== null && body.nextDueDate !== "") {
    if (typeof body.nextDueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.nextDueDate)) return fail("invalid_next_due_date");
    nextDueDate = new Date(`${body.nextDueDate}T00:00:00Z`);
    // After the visit, within 12 years (the longest-acting IUD).
    if (Number.isNaN(nextDueDate.getTime()) || nextDueDate.getTime() < visitDate.getTime() - DAY || nextDueDate.getTime() > visitDate.getTime() + 12 * 366 * DAY) {
      return fail("invalid_next_due_date");
    }
  }

  return ok({
    patientId: body.patientId,
    visitDate,
    clientStatus: body.clientStatus,
    counseled: bool(body.counseled),
    methodCode,
    procedure: procedure as FpVisitInput["procedure"],
    isPostpartum,
    referredByChw: bool(body.referredByChw),
    ...texts,
    nextDueDate,
  });
}
