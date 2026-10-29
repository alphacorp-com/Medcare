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

// ── Operating team ──────────────────────────────────────────────────────────

export const TEAM_ROLES = ["assistant_surgeon", "scrub_nurse", "circulating_nurse", "anesthesia_nurse", "other"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export interface TeamMember {
  userId: string;
  role: TeamRole;
}
const MAX_TEAM = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Besides surgeon and anaesthetist. The user ids are checked against the facility by the route.
export function parseTeam(raw: unknown): Parsed<TeamMember[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw) || raw.length > MAX_TEAM) return { ok: false, error: `team must be a list of at most ${MAX_TEAM} members` };
  const seen = new Set<string>();
  const team: TeamMember[] = [];
  for (const entry of raw as { userId?: unknown; role?: unknown }[]) {
    if (typeof entry?.userId !== "string" || !UUID.test(entry.userId)) return { ok: false, error: "team member: invalid userId" };
    if (!(TEAM_ROLES as readonly unknown[]).includes(entry.role)) return { ok: false, error: "team member: unknown role" };
    const key = `${entry.userId}:${entry.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    team.push({ userId: entry.userId, role: entry.role as TeamRole });
  }
  return { ok: true, value: team };
}

// ── Planned duration ────────────────────────────────────────────────────────

export const DEFAULT_SURGERY_DURATION_MINUTES = 90;

export function parseDuration(raw: unknown, { min = 5, max = 1440 } = {}): Parsed<number | null> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? { ok: true, value: n } : { ok: false, error: `expectedDurationMinutes must be an integer from ${min} to ${max}` };
}

// ── Operative times ─────────────────────────────────────────────────────────

export const OPERATIVE_TIME_FIELDS = ["anesthesiaStartAt", "incisionAt", "closureAt", "anesthesiaEndAt"] as const;
export type OperativeTimes = Partial<Record<(typeof OPERATIVE_TIME_FIELDS)[number], Date>>;

// Optional, but when given: in that order, not before the case started, not in the future.
export function parseOperativeTimes(raw: Record<string, unknown>, startedAt: Date | null, now: Date): Parsed<OperativeTimes> {
  const times: OperativeTimes = {};
  for (const field of OPERATIVE_TIME_FIELDS) {
    const value = raw[field];
    if (value === undefined || value === null || value === "") continue;
    const parsed = parseDate(value, field);
    if (!parsed.ok) return parsed;
    if (parsed.value.getTime() > now.getTime() + 60_000) return { ok: false, error: `${field} cannot be in the future` };
    // Anaesthesia may begin a little before the "start" click; an hour of slack.
    if (startedAt && parsed.value.getTime() < startedAt.getTime() - 60 * 60_000) return { ok: false, error: `${field} is before the start of the case` };
    times[field] = parsed.value;
  }
  const ordered = OPERATIVE_TIME_FIELDS.map((f) => times[f]).filter((d): d is Date => Boolean(d));
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].getTime() < ordered[i - 1].getTime()) return { ok: false, error: "Operative times must follow: anaesthesia start ≤ incision ≤ closure ≤ anaesthesia end" };
  }
  return { ok: true, value: times };
}

// ── Consumables and implants ────────────────────────────────────────────────

export interface SupplyInput {
  kind: "consumable" | "implant";
  itemId: string | null;
  itemName: string | null;
  quantity: number;
  lotNumber: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
}
const MAX_SUPPLIES = 60;

// A consumable is a stock article (taken out of stock); an implant is a stock article or an
// item from outside, then traced by its lot or serial number.
export function parseSupplies(raw: unknown): Parsed<SupplyInput[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw) || raw.length > MAX_SUPPLIES) return { ok: false, error: `supplies must be a list of at most ${MAX_SUPPLIES} lines` };
  const out: SupplyInput[] = [];
  for (const [index, entry] of (raw as Record<string, unknown>[]).entries()) {
    const line = `supply line ${index + 1}`;
    const kind = entry?.kind;
    if (kind !== "consumable" && kind !== "implant") return { ok: false, error: `${line}: unknown kind` };
    const itemId = typeof entry.itemId === "string" && entry.itemId ? entry.itemId : null;
    if (itemId && !UUID.test(itemId)) return { ok: false, error: `${line}: invalid itemId` };
    const quantity = Number(entry.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) return { ok: false, error: `${line}: quantity must be a whole number from 1` };
    const texts: Record<string, string | null> = {};
    for (const [field, max] of [["itemName", 255], ["lotNumber", 60], ["serialNumber", 120], ["manufacturer", 255]] as const) {
      const parsed = parseOptionalText(entry[field], `${line} ${field}`, max);
      if (!parsed.ok) return parsed;
      texts[field] = parsed.value;
    }
    if (kind === "consumable" && !itemId) return { ok: false, error: `${line}: a consumable must be a stock article` };
    if (!itemId && !texts.itemName) return { ok: false, error: `${line}: name required` };
    if (kind === "implant" && !itemId && !texts.lotNumber && !texts.serialNumber) {
      return { ok: false, error: `${line}: an implant from outside the stock needs its lot or serial number` };
    }
    out.push({ kind, itemId, itemName: texts.itemName, quantity, lotNumber: texts.lotNumber, serialNumber: texts.serialNumber, manufacturer: texts.manufacturer });
  }
  return { ok: true, value: out };
}

// ── Starting a case ─────────────────────────────────────────────────────────

export type StartBlocker = "signIn" | "timeOut" | "consent" | "preAnesthesia";

// What still prevents "Start": the WHO Sign In and Time Out, and — except in an emergency —
// the informed consent and the pre-anaesthesia visit.
export function startBlockers(
  surgery: { isEmergency: boolean; consentObtainedAt: Date | string | null; preAnesthesiaAt: Date | string | null },
  phases: { signIn: boolean; timeOut: boolean }
): StartBlocker[] {
  const blockers: StartBlocker[] = [];
  if (!phases.signIn) blockers.push("signIn");
  if (!phases.timeOut) blockers.push("timeOut");
  if (!surgery.isEmergency && !surgery.consentObtainedAt) blockers.push("consent");
  if (!surgery.isEmergency && !surgery.preAnesthesiaAt) blockers.push("preAnesthesia");
  return blockers;
}

// ── Overlap ─────────────────────────────────────────────────────────────────

// Two bookings [start, start + duration) overlap.
export function overlaps(aStart: Date, aMinutes: number, bStart: Date, bMinutes: number): boolean {
  const aEnd = aStart.getTime() + aMinutes * 60_000;
  const bEnd = bStart.getTime() + bMinutes * 60_000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}
