import { BREAKDOWN_COLUMNS, RMA3_MANUAL_INDICATORS, type Rma3ValueKind } from "@/lib/rma3-manual/catalog";

// Server-side validation of the RMA3 monthly form and of the MINSANTE identification.
// Pure, unit-tested in input.test.ts. Errors are codes, translated by the page.

export type Rma3InputResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Rma3InputResult<T> => ({ ok: true, value });
const fail = <T>(error: string): Rma3InputResult<T> => ({ ok: false, error });

// ── Period ──────────────────────────────────────────────────────────────────

// "YYYYMM" (the RMA3 / DHIS2 period). A month not started yet cannot be reported.
export function parsePeriod(input: string | null | undefined, now = new Date()): Rma3InputResult<string> {
  const match = /^(\d{4})(0[1-9]|1[0-2])$/.exec(input ?? "");
  if (!match) return fail("invalid_period");
  const start = Date.UTC(Number(match[1]), Number(match[2]) - 1, 1);
  if (start > now.getTime()) return fail("future_period");
  return ok(input!);
}

export function daysInPeriod(period: string): number {
  return new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)), 0)).getUTCDate();
}

// ── Values ──────────────────────────────────────────────────────────────────

// Upper bounds: a typo (an extra zero…) is refused rather than reported. Amounts are in
// FCFA and fit the Decimal(15, 0) column.
const MAX_BY_KIND: Record<Rma3ValueKind, number> = {
  count: 1_000_000,
  amount: 999_999_999_999,
  days: 31,
  yesNo: 1,
};

const MAX_CHANGES = 1_000;

export interface Rma3ValueChange {
  code: string;
  key: string;
  // null clears the cell (back to "not entered", which is not the same as 0).
  value: number | null;
}

export function parseValueChanges(body: unknown, period: string): Rma3InputResult<Rma3ValueChange[]> {
  const list = (body as { values?: unknown } | null)?.values;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_CHANGES) return fail("invalid_body");

  const seen = new Set<string>();
  const changes: Rma3ValueChange[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) return fail("invalid_body");
    const { code, key, value } = entry as { code?: unknown; key?: unknown; value?: unknown };
    const indicator = typeof code === "string" ? RMA3_MANUAL_INDICATORS.get(code) : undefined;
    if (!indicator) return fail("unknown_indicator");
    if (typeof key !== "string" || !BREAKDOWN_COLUMNS[indicator.breakdown].some((c) => c.key === key)) return fail("unknown_breakdown");
    const cell = `${indicator.code}|${key}`;
    if (seen.has(cell)) return fail("duplicate_cell");
    seen.add(cell);

    if (value === null) {
      changes.push({ code: indicator.code, key, value: null });
      continue;
    }
    const max = indicator.kind === "days" ? daysInPeriod(period) : MAX_BY_KIND[indicator.kind];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) return fail("invalid_value");
    changes.push({ code: indicator.code, key, value });
  }
  return ok(changes);
}

// ── Reopening a validated month ─────────────────────────────────────────────

export function parseReopenReason(body: unknown): Rma3InputResult<string> {
  const reason = (body as { reason?: unknown } | null)?.reason;
  if (typeof reason !== "string") return fail("invalid_reason");
  const trimmed = reason.trim();
  if (trimmed.length < 5 || trimmed.length > 500) return fail("invalid_reason");
  return ok(trimmed);
}

// ── MINSANTE identification (rarely changes: kept in the tenant settings) ──

export const OWNERSHIP_VALUES = ["public", "private", "faith_based", "community", "other"] as const;
export type Rma3Ownership = (typeof OWNERSHIP_VALUES)[number];

export interface Rma3IdentificationSettings {
  region: string | null; // I.-001
  department: string | null; // I.-002
  arrondissement: string | null; // I.-003
  district: string | null; // I.-004
  healthArea: string | null; // I.-005
  villagesServed: number | null; // I.-006
  villagesOutreach: number | null; // I.-007 (> 5 km, stratégie avancée)
  ownership: Rma3Ownership | null; // I.-009
  dataManagerName: string | null; // I.-013
  dataManagerPhone: string | null; // I.-014
  facilityManagerName: string | null; // I.-015
}

export const EMPTY_IDENTIFICATION: Rma3IdentificationSettings = {
  region: null,
  department: null,
  arrondissement: null,
  district: null,
  healthArea: null,
  villagesServed: null,
  villagesOutreach: null,
  ownership: null,
  dataManagerName: null,
  dataManagerPhone: null,
  facilityManagerName: null,
};

const TEXT_FIELDS = {
  region: 100,
  department: 100,
  arrondissement: 100,
  district: 100,
  healthArea: 100,
  dataManagerName: 150,
  facilityManagerName: 150,
} as const;

const PHONE = /^\+?[0-9 ().-]{6,30}$/;

// Empty strings become null. Every field is optional: the form can be filled in steps.
export function parseIdentification(body: unknown): Rma3InputResult<Rma3IdentificationSettings> {
  if (typeof body !== "object" || body === null) return fail("invalid_body");
  const input = body as Record<string, unknown>;
  const result: Rma3IdentificationSettings = { ...EMPTY_IDENTIFICATION };

  for (const [field, maxLength] of Object.entries(TEXT_FIELDS) as [keyof typeof TEXT_FIELDS, number][]) {
    const raw = input[field];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string" || raw.trim().length > maxLength) return fail(`invalid_${field}`);
    result[field] = raw.trim() || null;
  }

  for (const field of ["villagesServed", "villagesOutreach"] as const) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 10_000) return fail(`invalid_${field}`);
    result[field] = raw;
  }
  if (result.villagesServed !== null && result.villagesOutreach !== null && result.villagesOutreach > result.villagesServed) {
    return fail("invalid_villagesOutreach");
  }

  if (input.ownership !== undefined && input.ownership !== null && input.ownership !== "") {
    if (!OWNERSHIP_VALUES.includes(input.ownership as Rma3Ownership)) return fail("invalid_ownership");
    result.ownership = input.ownership as Rma3Ownership;
  }

  const phone = input.dataManagerPhone;
  if (phone !== undefined && phone !== null && phone !== "") {
    if (typeof phone !== "string" || !PHONE.test(phone.trim())) return fail("invalid_dataManagerPhone");
    result.dataManagerPhone = phone.trim();
  }

  return ok(result);
}

// Reading back what was stored (a TenantSetting JSON value): anything malformed is dropped
// field by field rather than trusted.
export function readIdentification(stored: unknown): Rma3IdentificationSettings {
  const parsed = parseIdentification(stored);
  if (parsed.ok) return parsed.value;
  if (typeof stored !== "object" || stored === null) return { ...EMPTY_IDENTIFICATION };
  const result = { ...EMPTY_IDENTIFICATION };
  for (const field of Object.keys(EMPTY_IDENTIFICATION) as (keyof Rma3IdentificationSettings)[]) {
    const single = parseIdentification({ [field]: (stored as Record<string, unknown>)[field] });
    if (single.ok) (result as Record<string, unknown>)[field] = single.value[field];
  }
  return result;
}
