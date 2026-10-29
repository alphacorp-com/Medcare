// Input rules of the surgery routes. Pure, unit-tested in validation.test.ts.

export const COMPLICATION_KEYS = ["bleeding", "infection", "anesthesia_reaction", "organ_injury", "none"] as const;
export type ComplicationKey = (typeof COMPLICATION_KEYS)[number];

export const SURGERY_TEXT_LIMITS = {
  procedureLabel: 255,
  procedureCode: 30,
  surgicalReport: 30_000,
  anesthesiaReport: 15_000,
  reason: 1_000,
};

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// ASA physical status: 1 to 6. Empty → not given.
export function parseAsaScore(raw: unknown): Parsed<number | null> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? { ok: true, value: n } : { ok: false, error: "asaScore must be an integer from 1 to 6" };
}

export function parseDate(raw: unknown, field: string): Parsed<Date> {
  const date = typeof raw === "string" || typeof raw === "number" ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? { ok: true, value: date } : { ok: false, error: `${field} must be a valid date` };
}

// Known keys only, each once; "none" cannot be combined with an actual complication.
export function parseComplications(raw: unknown): Parsed<ComplicationKey[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "complications must be a list" };
  const keys = [...new Set(raw)];
  if (!keys.every((k): k is ComplicationKey => (COMPLICATION_KEYS as readonly unknown[]).includes(k))) {
    return { ok: false, error: "Unknown complication" };
  }
  if (keys.includes("none") && keys.length > 1) return { ok: false, error: '"none" cannot be combined with a complication' };
  return { ok: true, value: keys };
}

// Optional free text: trimmed, empty → null, refused above `max` characters.
export function parseOptionalText(raw: unknown, field: string, max: number): Parsed<string | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: `${field} must be text` };
  const value = raw.trim();
  if (value.length > max) return { ok: false, error: `${field} is too long (max ${max})` };
  return { ok: true, value: value || null };
}

export function parseRequiredText(raw: unknown, field: string, max: number): Parsed<string> {
  const parsed = parseOptionalText(raw, field, max);
  if (!parsed.ok) return parsed;
  return parsed.value ? { ok: true, value: parsed.value } : { ok: false, error: `${field} is required` };
}
