import { findRegimen } from "@/lib/hiv/regimens";

// Validation of the HIV / PMTCT / hepatitis / STI forms. Pure, unit-tested in input.test.ts;
// every route validates server-side with these. Ownership of the ids (patient, pregnancy,
// enrolment, case) is checked by the routes against the session's tenant.

export const SCREENING_TEST_TYPES = ["hiv", "hiv_pcr", "syphilis", "hbsag", "hcv", "hdv", "chlamydia", "mycoplasma", "gonorrhea", "other_sti"] as const;
export type ScreeningTestType = (typeof SCREENING_TEST_TYPES)[number];
export const SCREENING_RESULTS = ["positive", "negative", "indeterminate", "invalid"] as const;
export type ScreeningResult = (typeof SCREENING_RESULTS)[number];
export const ENTRY_POINTS = [
  "index_case",
  "emergency",
  "antenatal",
  "maternity",
  "postnatal",
  "pediatric",
  "inpatient",
  "outpatient",
  "vct",
  "tb",
  "sti",
  "family_planning",
  "community",
  "other",
] as const;
export type EntryPoint = (typeof ENTRY_POINTS)[number];
export const REFERRAL_SOURCES = ["none", "asc", "obc"] as const;
export const TRANSFER_SCOPES = ["in_country", "abroad"] as const;
export const CARE_STATUSES = ["active", "transferred_out", "dead", "stopped"] as const;
export const VIRAL_LOAD_PROGRAMS = ["hiv", "hbv", "hcv"] as const;
export const HEPATITIS_TYPES = ["hbv", "hcv"] as const;

// STI register types (IV.1.3 "porteuses d'IST").
export const STI_TEST_TYPES: readonly ScreeningTestType[] = ["syphilis", "chlamydia", "mycoplasma", "gonorrhea", "other_sti"];

export type HivInputError =
  | "invalid_patient"
  | "invalid_test_type"
  | "invalid_result"
  | "invalid_entry_point"
  | "invalid_referral"
  | "invalid_date"
  | "future_date"
  | "date_order"
  | "invalid_pregnancy"
  | "invalid_notes"
  | "invalid_regimen"
  | "invalid_days"
  | "invalid_transfer"
  | "invalid_status"
  | "invalid_program"
  | "invalid_value"
  | "invalid_origin"
  | "invalid_type";

type Result<T> = { ok: true; value: T } | { ok: false; error: HivInputError };
const fail = (error: HivInputError) => ({ ok: false as const, error });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

const endOfToday = (now: Date) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 86_400_000;

// YYYY-MM-DD → UTC midnight; not after today. `undefined` → null when optional.
function day(value: unknown, now: Date, { optional = false } = {}): Date | null | HivInputError {
  if (value === undefined || value === null || value === "") return optional ? null : "invalid_date";
  if (typeof value !== "string" || !DATE_RE.test(value)) return "invalid_date";
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return "invalid_date";
  return d.getTime() >= endOfToday(now) ? "future_date" : d;
}

// YYYY-MM-DD (any date: appointments are in the future).
function anyDay(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

// ISO date-time or YYYY-MM-DD (today → now, earlier day → noon UTC); not in the future.
function instant(value: unknown, now: Date): Date | HivInputError {
  if (value === undefined || value === null || value === "") return now;
  if (typeof value !== "string") return "invalid_date";
  if (DATE_RE.test(value)) {
    const d = day(value, now);
    if (!(d instanceof Date)) return (d ?? "invalid_date") as HivInputError;
    return value === now.toISOString().slice(0, 10) ? now : new Date(d.getTime() + 12 * 3_600_000);
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "invalid_date";
  return at.getTime() > now.getTime() + 5 * 60_000 ? "future_date" : at;
}

function notes(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length > 500 ? undefined : t || null;
}

const optionalUuid = (value: unknown): string | null | undefined =>
  value === undefined || value === null || value === "" ? null : isUuid(value) ? value : undefined;

// ── Screening test ──────────────────────────────────────────────────────────

export interface ScreeningTestInput {
  patientId: string;
  testType: ScreeningTestType;
  testedAt: Date;
  result: ScreeningResult;
  entryPoint: EntryPoint;
  isRetest: boolean;
  resultCollectedAt: Date | null;
  pregnancyId: string | null;
  partnerOfPregnancyId: string | null;
  referralSource: (typeof REFERRAL_SOURCES)[number];
  treatedAt: Date | null;
  notes: string | null;
}

export function parseScreeningTest(body: Record<string, unknown>, now = new Date()): Result<ScreeningTestInput> {
  if (!isUuid(body.patientId)) return fail("invalid_patient");
  if (!oneOf(SCREENING_TEST_TYPES, body.testType)) return fail("invalid_test_type");
  if (!oneOf(SCREENING_RESULTS, body.result)) return fail("invalid_result");
  if (!oneOf(ENTRY_POINTS, body.entryPoint)) return fail("invalid_entry_point");
  const referral = body.referralSource ?? "none";
  if (!oneOf(REFERRAL_SOURCES, referral)) return fail("invalid_referral");
  const testedAt = instant(body.testedAt, now);
  if (typeof testedAt === "string") return fail(testedAt);
  const collected = body.resultCollectedAt ? instant(body.resultCollectedAt, now) : null;
  if (typeof collected === "string") return fail(collected);
  const treated = body.treatedAt ? instant(body.treatedAt, now) : null;
  if (typeof treated === "string") return fail(treated);
  if ((collected && collected < testedAt) || (treated && treated < new Date(testedAt.getTime() - 86_400_000))) return fail("date_order");
  const pregnancyId = optionalUuid(body.pregnancyId);
  const partnerOf = optionalUuid(body.partnerOfPregnancyId);
  if (pregnancyId === undefined || partnerOf === undefined || (pregnancyId && partnerOf)) return fail("invalid_pregnancy");
  const n = notes(body.notes);
  if (n === undefined) return fail("invalid_notes");
  return {
    ok: true,
    value: {
      patientId: body.patientId,
      testType: body.testType,
      testedAt,
      result: body.result,
      entryPoint: body.entryPoint,
      isRetest: body.isRetest === true,
      resultCollectedAt: collected,
      pregnancyId,
      partnerOfPregnancyId: partnerOf,
      referralSource: referral,
      // Only a positive syphilis / STI result is treated.
      treatedAt: body.result === "positive" ? treated : null,
      notes: n,
    },
  };
}

// ── ART enrolment and visits ────────────────────────────────────────────────

export interface EnrolmentInput {
  patientId: string;
  hivDiagnosisDate: Date | null;
  artStartDate: Date;
  enrolledAt: Date;
  entryPoint: EntryPoint;
  transferIn: (typeof TRANSFER_SCOPES)[number] | null;
  pregnancyId: string | null;
  notes: string | null;
}

export function parseEnrolment(body: Record<string, unknown>, now = new Date()): Result<EnrolmentInput> {
  if (!isUuid(body.patientId)) return fail("invalid_patient");
  const diagnosis = day(body.hivDiagnosisDate, now, { optional: true });
  if (typeof diagnosis === "string") return fail(diagnosis);
  const artStart = day(body.artStartDate, now);
  if (!(artStart instanceof Date)) return fail((artStart ?? "invalid_date") as HivInputError);
  const enrolled = body.enrolledAt ? day(body.enrolledAt, now) : artStart;
  if (!(enrolled instanceof Date)) return fail((enrolled ?? "invalid_date") as HivInputError);
  if (diagnosis && diagnosis > artStart) return fail("date_order");
  if (!oneOf(ENTRY_POINTS, body.entryPoint)) return fail("invalid_entry_point");
  const transferIn = body.transferIn === undefined || body.transferIn === null || body.transferIn === "" ? null : body.transferIn;
  if (transferIn !== null && !oneOf(TRANSFER_SCOPES, transferIn)) return fail("invalid_transfer");
  // ART started here can't predate the enrolment here; a transfer brings an earlier start.
  if (!transferIn && enrolled > artStart) return fail("date_order");
  const pregnancyId = optionalUuid(body.pregnancyId);
  if (pregnancyId === undefined) return fail("invalid_pregnancy");
  const n = notes(body.notes);
  if (n === undefined) return fail("invalid_notes");
  return { ok: true, value: { patientId: body.patientId, hivDiagnosisDate: diagnosis, artStartDate: artStart, enrolledAt: enrolled, entryPoint: body.entryPoint, transferIn, pregnancyId, notes: n } };
}

export interface StatusChangeInput {
  status: (typeof CARE_STATUSES)[number];
  statusChangedAt: Date | null;
  transferOut: (typeof TRANSFER_SCOPES)[number] | null;
}

export function parseStatusChange(body: Record<string, unknown>, now = new Date()): Result<StatusChangeInput> {
  if (!oneOf(CARE_STATUSES, body.status)) return fail("invalid_status");
  if (body.status === "active") return { ok: true, value: { status: "active", statusChangedAt: null, transferOut: null } };
  const at = day(body.statusChangedAt, now);
  if (!(at instanceof Date)) return fail((at ?? "invalid_date") as HivInputError);
  const transferOut = body.status === "transferred_out" ? body.transferOut : null;
  if (body.status === "transferred_out" && !oneOf(TRANSFER_SCOPES, transferOut)) return fail("invalid_transfer");
  return { ok: true, value: { status: body.status, statusChangedAt: at, transferOut: transferOut as StatusChangeInput["transferOut"] } };
}

export interface ArtVisitInput {
  visitDate: Date;
  regimenCode: string;
  regimenLine: 1 | 2 | 3;
  daysDispensed: number;
  nextAppointmentDate: Date;
  isEmergencySupply: boolean;
  tbScreened: boolean;
  tbSymptomsPositive: boolean;
  tbTested: boolean;
  tbConfirmed: boolean;
  tbTreatmentStarted: boolean;
  iptStarted: boolean;
  notes: string | null;
}

// The line comes from the regimen; the next appointment defaults to visit + days dispensed.
export function parseArtVisit(body: Record<string, unknown>, now = new Date()): Result<ArtVisitInput> {
  const visitDate = day(body.visitDate ?? now.toISOString().slice(0, 10), now);
  if (!(visitDate instanceof Date)) return fail((visitDate ?? "invalid_date") as HivInputError);
  const regimen = typeof body.regimenCode === "string" ? findRegimen(body.regimenCode) : undefined;
  if (!regimen) return fail("invalid_regimen");
  const days = typeof body.daysDispensed === "string" ? Number(body.daysDispensed) : body.daysDispensed;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 366) return fail("invalid_days");
  const next = body.nextAppointmentDate ? anyDay(body.nextAppointmentDate) : new Date(visitDate.getTime() + days * 86_400_000);
  if (!next) return fail("invalid_date");
  if (next < visitDate) return fail("date_order");
  const flag = (k: string) => body[k] === true;
  // TB answers are cumulative: a confirmation implies screening and testing.
  const tbConfirmed = flag("tbConfirmed");
  const tbTreatmentStarted = flag("tbTreatmentStarted");
  const n = notes(body.notes);
  if (n === undefined) return fail("invalid_notes");
  return {
    ok: true,
    value: {
      visitDate,
      regimenCode: regimen.code,
      regimenLine: regimen.line,
      daysDispensed: days,
      nextAppointmentDate: next,
      isEmergencySupply: flag("isEmergencySupply"),
      tbScreened: flag("tbScreened") || flag("tbSymptomsPositive") || flag("tbTested") || tbConfirmed || tbTreatmentStarted,
      tbSymptomsPositive: flag("tbSymptomsPositive") || flag("tbTested") || tbConfirmed,
      tbTested: flag("tbTested") || tbConfirmed,
      tbConfirmed: tbConfirmed || tbTreatmentStarted,
      tbTreatmentStarted,
      iptStarted: flag("iptStarted"),
      notes: n,
    },
  };
}

// ── Viral load ──────────────────────────────────────────────────────────────

export interface ViralLoadInput {
  patientId: string;
  program: (typeof VIRAL_LOAD_PROGRAMS)[number];
  sampledAt: Date;
  value: number | null;
  belowDetection: boolean;
  pregnancyId: string | null;
}

export function parseViralLoad(body: Record<string, unknown>, now = new Date()): Result<ViralLoadInput> {
  if (!isUuid(body.patientId)) return fail("invalid_patient");
  if (!oneOf(VIRAL_LOAD_PROGRAMS, body.program)) return fail("invalid_program");
  const sampledAt = day(body.sampledAt, now);
  if (!(sampledAt instanceof Date)) return fail((sampledAt ?? "invalid_date") as HivInputError);
  const belowDetection = body.belowDetection === true;
  let value: number | null = null;
  if (!belowDetection) {
    const v = typeof body.value === "string" && body.value.trim() !== "" ? Number(body.value) : body.value;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 2_000_000_000) return fail("invalid_value");
    value = v;
  }
  const pregnancyId = optionalUuid(body.pregnancyId);
  if (pregnancyId === undefined) return fail("invalid_pregnancy");
  return { ok: true, value: { patientId: body.patientId, program: body.program, sampledAt, value, belowDetection, pregnancyId } };
}

// HIV: suppressed below 1000 copies/mL (WHO threshold); hepatitis: undetectable only.
export function isSuppressed(program: (typeof VIRAL_LOAD_PROGRAMS)[number], value: number | null, belowDetection: boolean): boolean {
  if (belowDetection) return true;
  return program === "hiv" && value !== null && value < 1000;
}

// ── Exposed infant ──────────────────────────────────────────────────────────

export interface ExposedInfantInput {
  patientId: string;
  motherPatientId: string | null;
  bornInFacility: boolean;
  firstSeenAt: Date;
  nevirapineStartedAt: Date | null;
  cotrimoxazoleStartedAt: Date | null;
  visit6to8WeeksAt: Date | null;
  notes: string | null;
}

export function parseExposedInfant(body: Record<string, unknown>, now = new Date()): Result<ExposedInfantInput> {
  if (!isUuid(body.patientId)) return fail("invalid_patient");
  const mother = optionalUuid(body.motherPatientId);
  if (mother === undefined || mother === body.patientId) return fail("invalid_patient");
  const firstSeen = day(body.firstSeenAt ?? now.toISOString().slice(0, 10), now);
  if (!(firstSeen instanceof Date)) return fail((firstSeen ?? "invalid_date") as HivInputError);
  const dates: Record<string, Date | null> = {};
  for (const key of ["nevirapineStartedAt", "cotrimoxazoleStartedAt", "visit6to8WeeksAt"]) {
    const d = day(body[key], now, { optional: true });
    if (typeof d === "string") return fail(d);
    dates[key] = d;
  }
  const n = notes(body.notes);
  if (n === undefined) return fail("invalid_notes");
  return {
    ok: true,
    value: {
      patientId: body.patientId,
      motherPatientId: mother,
      bornInFacility: body.bornInFacility !== false,
      firstSeenAt: firstSeen,
      nevirapineStartedAt: dates.nevirapineStartedAt,
      cotrimoxazoleStartedAt: dates.cotrimoxazoleStartedAt,
      visit6to8WeeksAt: dates.visit6to8WeeksAt,
      notes: n,
    },
  };
}

// ── Hepatitis case ──────────────────────────────────────────────────────────

export interface HepatitisCaseInput {
  patientId: string;
  type: (typeof HEPATITIS_TYPES)[number];
  diagnosedAt: Date;
  deltaPositive: boolean | null;
  eligibleAt: Date | null;
  treatmentStartedAt: Date | null;
  treatmentStoppedAt: Date | null;
  curedAt: Date | null;
  cirrhosisAt: Date | null;
  liverCancerAt: Date | null;
  diedAt: Date | null;
  notes: string | null;
}

export function parseHepatitisCase(body: Record<string, unknown>, now = new Date()): Result<HepatitisCaseInput> {
  if (!isUuid(body.patientId)) return fail("invalid_patient");
  if (!oneOf(HEPATITIS_TYPES, body.type)) return fail("invalid_type");
  const diagnosedAt = day(body.diagnosedAt, now);
  if (!(diagnosedAt instanceof Date)) return fail((diagnosedAt ?? "invalid_date") as HivInputError);
  const dates: Record<string, Date | null> = {};
  for (const key of ["eligibleAt", "treatmentStartedAt", "treatmentStoppedAt", "curedAt", "cirrhosisAt", "liverCancerAt", "diedAt"]) {
    const d = day(body[key], now, { optional: true });
    if (typeof d === "string") return fail(d);
    if (d && d < diagnosedAt) return fail("date_order");
    dates[key] = d;
  }
  if (dates.treatmentStoppedAt && (!dates.treatmentStartedAt || dates.treatmentStoppedAt < dates.treatmentStartedAt)) return fail("date_order");
  // Cure is a hepatitis C outcome; delta co-infection only exists with hepatitis B.
  if (body.type === "hbv" && dates.curedAt) return fail("invalid_type");
  const delta = body.type === "hbv" && typeof body.deltaPositive === "boolean" ? body.deltaPositive : null;
  const n = notes(body.notes);
  if (n === undefined) return fail("invalid_notes");
  return {
    ok: true,
    value: {
      patientId: body.patientId,
      type: body.type,
      diagnosedAt,
      deltaPositive: delta,
      eligibleAt: dates.eligibleAt,
      treatmentStartedAt: dates.treatmentStartedAt,
      treatmentStoppedAt: dates.treatmentStoppedAt,
      curedAt: dates.curedAt,
      cirrhosisAt: dates.cirrhosisAt,
      liverCancerAt: dates.liverCancerAt,
      diedAt: dates.diedAt,
      notes: n,
    },
  };
}

// ── ARV emergency supply (patient followed elsewhere) ───────────────────────

export interface EmergencySupplyInput {
  patientId: string;
  supplyDate: Date;
  regimenCode: string;
  regimenLine: 1 | 2 | 3;
  daysDispensed: number;
  originSite: string;
}

export function parseEmergencySupply(body: Record<string, unknown>, now = new Date()): Result<EmergencySupplyInput> {
  if (!isUuid(body.patientId)) return fail("invalid_patient");
  const supplyDate = day(body.supplyDate ?? now.toISOString().slice(0, 10), now);
  if (!(supplyDate instanceof Date)) return fail((supplyDate ?? "invalid_date") as HivInputError);
  const regimen = typeof body.regimenCode === "string" ? findRegimen(body.regimenCode) : undefined;
  if (!regimen) return fail("invalid_regimen");
  const days = typeof body.daysDispensed === "string" ? Number(body.daysDispensed) : body.daysDispensed;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 366) return fail("invalid_days");
  const origin = typeof body.originSite === "string" ? body.originSite.trim() : "";
  if (!origin || origin.length > 150) return fail("invalid_origin");
  return { ok: true, value: { patientId: body.patientId, supplyDate, regimenCode: regimen.code, regimenLine: regimen.line, daysDispensed: days, originSite: origin } };
}
