// Prescription lines and the stock article they draw from. Pure, unit-tested in
// prescription-items.test.ts.
//
// Since the prescriber picks the article (closed list) and the quantity, a line carries
// `inventoryId` (+ `quantity`) or `inventoryId: null` for a drug the pharmacy does not stock
// (free text, never dispensed from the stock). Lines written before that rule have no
// `inventoryId` key at all: only they fall back to the article of the same name (or to the
// seed's `drugCode`), so the name is never used to resolve a new prescription.

export const MAX_PRESCRIPTION_LINES = 30;
export const MAX_LINE_QUANTITY = 100_000;
const MAX_TEXT = 255;

export interface PrescriptionLine {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  inventoryId: string | null;
  // Units to dispense (whole units of the article); null for an unstocked drug.
  quantity: number | null;
}

export type PrescriptionLineError = "not_a_list" | "too_many_lines" | "invalid_line" | "invalid_drug" | "invalid_quantity" | "quantity_required";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.trim().length > MAX_TEXT) return null;
  return value.trim();
}

// Validates the lines sent by the prescriber. The article's existence (tenant, active) and
// its canonical name are checked by the route against the database.
export function parsePrescriptionLines(raw: unknown): { ok: true; lines: PrescriptionLine[] } | { ok: false; error: PrescriptionLineError; index?: number } {
  if (!Array.isArray(raw)) return { ok: false, error: "not_a_list" };
  if (raw.length > MAX_PRESCRIPTION_LINES) return { ok: false, error: "too_many_lines" };
  const lines: PrescriptionLine[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object") return { ok: false, error: "invalid_line", index };
    const e = entry as Record<string, unknown>;
    const drug = optionalText(e.drug);
    if (!drug) return { ok: false, error: "invalid_drug", index };
    const dosage = optionalText(e.dosage);
    const frequency = optionalText(e.frequency);
    const duration = optionalText(e.duration);
    const instructions = optionalText(e.instructions);
    if (dosage === null || frequency === null || duration === null || instructions === null) return { ok: false, error: "invalid_line", index };

    const inventoryId = e.inventoryId === undefined || e.inventoryId === null || e.inventoryId === "" ? null : e.inventoryId;
    if (inventoryId !== null && (typeof inventoryId !== "string" || !UUID_RE.test(inventoryId))) return { ok: false, error: "invalid_line", index };

    let quantity: number | null = null;
    if (inventoryId) {
      const q = typeof e.quantity === "string" && e.quantity.trim() !== "" ? Number(e.quantity) : e.quantity;
      if (q === undefined || q === null || q === "") return { ok: false, error: "quantity_required", index };
      if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_LINE_QUANTITY) return { ok: false, error: "invalid_quantity", index };
      quantity = q;
    }
    lines.push({ drug, dosage, frequency, duration, ...(instructions ? { instructions } : {}), inventoryId, quantity });
  }
  if (lines.length === 0) return { ok: false, error: "not_a_list" };
  return { ok: true, lines };
}

// Stored line, whatever its age (current lines, pre-rule lines, seed lines).
export interface StoredPrescriptionLine {
  drug?: string;
  name?: string;
  drugName?: string;
  drugCode?: string;
  inventoryId?: string | null;
  quantity?: number | string | null;
  unit?: string;
}

export function lineDrugName(line: StoredPrescriptionLine): string {
  return (line.drug || line.name || line.drugName || "").trim();
}

// Whole units to take from the stock (a fractional legacy quantity consumes the unit it
// was taken from); 0 when none.
export function lineUnits(line: StoredPrescriptionLine): number {
  const q = typeof line.quantity === "number" ? line.quantity : parseFloat(String(line.quantity ?? ""));
  return Number.isFinite(q) && q > 0 ? Math.ceil(q) : 0;
}

export interface ArticleRef {
  id: string;
  name: string;
}

// The article a stored line draws from, or null (unstocked drug).
export function resolveLineArticle<A extends ArticleRef>(line: StoredPrescriptionLine, byId: ReadonlyMap<string, A>, byLowerName: ReadonlyMap<string, A>): A | null {
  if ("inventoryId" in line) return line.inventoryId ? byId.get(line.inventoryId) ?? null : null;
  // Pre-rule lines only.
  if (line.drugCode && byId.has(line.drugCode)) return byId.get(line.drugCode)!;
  return byLowerName.get(lineDrugName(line).toLowerCase()) ?? null;
}

export function parseStoredLines(items: unknown): StoredPrescriptionLine[] {
  try {
    const value = typeof items === "string" ? JSON.parse(items) : items;
    return Array.isArray(value) ? (value.filter((v) => v && typeof v === "object") as StoredPrescriptionLine[]) : [];
  } catch {
    return [];
  }
}
