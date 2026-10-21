// Validation of the EPI forms: vaccination sessions, AEFI (MAPI) reports, cold chain
// equipment and temperature readings. Pure, unit-tested in input.test.ts; every route
// validates server-side with these.

export const VACCINATION_STRATEGIES = ["fixed", "outreach"] as const;
export type VaccinationStrategy = (typeof VACCINATION_STRATEGIES)[number];

export const POPULATION_GROUPS = ["general", "nomad", "pygmy", "refugee"] as const;
export type PopulationGroup = (typeof POPULATION_GROUPS)[number];

export const SESSION_STATUSES = ["planned", "held", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const AEFI_SERIOUSNESS = ["minor", "serious"] as const;
export const AEFI_OUTCOMES = ["unknown", "recovering", "recovered", "sequelae", "death"] as const;

export const EQUIPMENT_TYPES = ["refrigerator", "freezer", "cold_box", "vaccine_carrier"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];
export const EQUIPMENT_STATUSES = ["functional", "needs_repair", "out_of_service"] as const;

// Storage range of the vaccines in each kind of equipment (°C): +2/+8 for refrigerators,
// cold boxes and carriers; -25/-15 for the freezers (ice packs, OPV in some districts).
export const DEFAULT_TEMPERATURE_RANGE: Record<EquipmentType, { min: number; max: number }> = {
  refrigerator: { min: 2, max: 8 },
  freezer: { min: -25, max: -15 },
  cold_box: { min: 2, max: 8 },
  vaccine_carrier: { min: 2, max: 8 },
};

export type EpiInputError =
  | "invalid_date"
  | "future_date"
  | "invalid_strategy"
  | "invalid_population"
  | "invalid_site"
  | "invalid_status"
  | "invalid_notes"
  | "invalid_seriousness"
  | "invalid_outcome"
  | "invalid_description"
  | "invalid_immunization"
  | "onset_before_dose"
  | "invalid_code"
  | "invalid_label"
  | "invalid_type"
  | "invalid_range"
  | "invalid_temperature"
  | "invalid_equipment"
  | "invalid_location";

type Result<T> = { ok: true; value: T } | { ok: false; error: EpiInputError };
const fail = (error: EpiInputError) => ({ ok: false as const, error });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
export const isStrategy = (value: unknown): value is VaccinationStrategy => (VACCINATION_STRATEGIES as readonly unknown[]).includes(value);
export const isPopulationGroup = (value: unknown): value is PopulationGroup => (POPULATION_GROUPS as readonly unknown[]).includes(value);

function text(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.length > max ? undefined : trimmed;
}

// YYYY-MM-DD → UTC midnight (the @db.Date convention).
function calendarDate(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

// A date-time from the browser (ISO), not in the future (5 min clock tolerance).
function pastInstant(value: unknown, now: Date): Date | EpiInputError {
  if (typeof value !== "string") return "invalid_date";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "invalid_date";
  if (at.getTime() > now.getTime() + 5 * 60_000) return "future_date";
  return at;
}

// Temperature in °C with one decimal, within what a thermometer can read in the field.
function temperature(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < -60 || n > 60) return null;
  return Math.round(n * 10) / 10;
}

// ── Sessions ────────────────────────────────────────────────────────────────

export interface SessionInput {
  scheduledDate: Date;
  strategy: VaccinationStrategy;
  site: string;
  notes: string | null;
}

export function parseSessionInput(body: Record<string, unknown>): Result<SessionInput> {
  const scheduledDate = calendarDate(body.scheduledDate);
  if (!scheduledDate) return fail("invalid_date");
  if (!isStrategy(body.strategy)) return fail("invalid_strategy");
  const site = text(body.site, 150);
  if (!site) return fail("invalid_site");
  const notes = text(body.notes, 500);
  if (notes === undefined) return fail("invalid_notes");
  return { ok: true, value: { scheduledDate, strategy: body.strategy, site, notes } };
}

export function parseSessionStatus(value: unknown): Result<SessionStatus> {
  return (SESSION_STATUSES as readonly unknown[]).includes(value) ? { ok: true, value: value as SessionStatus } : fail("invalid_status");
}

// ── AEFI (MAPI) ─────────────────────────────────────────────────────────────

export interface AefiInput {
  immunizationId: string;
  onsetAt: Date;
  seriousness: (typeof AEFI_SERIOUSNESS)[number];
  outcome: (typeof AEFI_OUTCOMES)[number];
  hospitalized: boolean;
  description: string;
}

// The dose date is checked by the route (onset cannot precede the dose).
export function parseAefiInput(body: Record<string, unknown>, now = new Date()): Result<AefiInput> {
  if (!isUuid(body.immunizationId)) return fail("invalid_immunization");
  const onsetAt = pastInstant(body.onsetAt, now);
  if (typeof onsetAt === "string") return fail(onsetAt);
  if (!(AEFI_SERIOUSNESS as readonly unknown[]).includes(body.seriousness)) return fail("invalid_seriousness");
  const outcome = body.outcome === undefined || body.outcome === null || body.outcome === "" ? "unknown" : body.outcome;
  if (!(AEFI_OUTCOMES as readonly unknown[]).includes(outcome)) return fail("invalid_outcome");
  const description = text(body.description, 2000);
  if (!description) return fail("invalid_description");
  return {
    ok: true,
    value: {
      immunizationId: body.immunizationId,
      onsetAt,
      seriousness: body.seriousness as AefiInput["seriousness"],
      outcome: outcome as AefiInput["outcome"],
      hospitalized: body.hospitalized === true,
      description,
    },
  };
}

// ── Cold chain ──────────────────────────────────────────────────────────────

export interface EquipmentInput {
  code: string;
  type: EquipmentType;
  label: string;
  locationId: string | null;
  minTempC: number;
  maxTempC: number;
  status: (typeof EQUIPMENT_STATUSES)[number];
}

// Missing range = the standard range of the equipment type.
export function parseEquipmentInput(body: Record<string, unknown>): Result<EquipmentInput> {
  const code = text(body.code, 40);
  if (!code) return fail("invalid_code");
  if (!(EQUIPMENT_TYPES as readonly unknown[]).includes(body.type)) return fail("invalid_type");
  const type = body.type as EquipmentType;
  const label = text(body.label, 150);
  if (!label) return fail("invalid_label");
  const locationId = body.locationId === undefined || body.locationId === null || body.locationId === "" ? null : body.locationId;
  if (locationId !== null && !isUuid(locationId)) return fail("invalid_location");
  const defaults = DEFAULT_TEMPERATURE_RANGE[type];
  const minTempC = body.minTempC === undefined || body.minTempC === null || body.minTempC === "" ? defaults.min : temperature(body.minTempC);
  const maxTempC = body.maxTempC === undefined || body.maxTempC === null || body.maxTempC === "" ? defaults.max : temperature(body.maxTempC);
  if (minTempC === null || maxTempC === null || minTempC >= maxTempC) return fail("invalid_range");
  const status = body.status === undefined ? "functional" : body.status;
  if (!(EQUIPMENT_STATUSES as readonly unknown[]).includes(status)) return fail("invalid_status");
  return {
    ok: true,
    value: { code: code.toUpperCase(), type, label, locationId, minTempC, maxTempC, status: status as EquipmentInput["status"] },
  };
}

export interface ReadingInput {
  equipmentId: string;
  readAt: Date;
  temperatureC: number;
  notes: string | null;
}

export function parseReadingInput(body: Record<string, unknown>, now = new Date()): Result<ReadingInput> {
  if (!isUuid(body.equipmentId)) return fail("invalid_equipment");
  const readAt = body.readAt === undefined || body.readAt === null || body.readAt === "" ? now : pastInstant(body.readAt, now);
  if (typeof readAt === "string") return fail(readAt);
  const temperatureC = temperature(body.temperatureC);
  if (temperatureC === null) return fail("invalid_temperature");
  const notes = text(body.notes, 255);
  if (notes === undefined) return fail("invalid_notes");
  return { ok: true, value: { equipmentId: body.equipmentId, readAt, temperatureC, notes } };
}
