// Validation of the stock forms (receipt, loss, inventory count) and of the article's
// stock settings. Pure, unit-tested in input.test.ts. Every route validates server-side
// with these, whatever the UI already checked.

export const RMA3_STOCK_CATEGORIES = ["tracer", "epi_input", "antimalarial", "oxygen", "nutrition"] as const;
export type Rma3StockCategory = (typeof RMA3_STOCK_CATEGORIES)[number];
// RMA3 III.7 child treatments: a diagnosis treated with such an article in the same stay
// counts as "SRO", "SRO + zinc" or "pneumonia treated with an antibiotic"; iron / folic acid
// prescribed to adolescent girls counts in III.8-003.
export const RMA3_TREATMENTS = ["ors", "zinc", "antibiotic", "iron_folate"] as const;
export type Rma3Treatment = (typeof RMA3_TREATMENTS)[number];

export const LOSS_TYPES = ["expired", "damaged", "lost"] as const;
export type LossType = (typeof LOSS_TYPES)[number];

// Large enough for any real delivery, small enough to catch a typo (and to stay an Int).
export const MAX_MOVEMENT_QUANTITY = 1_000_000;
const MAX_REASON = 255;
const MAX_LOT_NUMBER = 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type StockInputError =
  | "invalid_quantity"
  | "invalid_lot_number"
  | "invalid_expiry_date"
  | "invalid_date"
  | "future_date"
  | "invalid_unit_cost"
  | "invalid_reason"
  | "reason_required"
  | "invalid_loss_type"
  | "invalid_lot"
  | "invalid_location"
  | "invalid_kind";

type Result<T> = { ok: true; value: T } | { ok: false; error: StockInputError };

const fail = (error: StockInputError) => ({ ok: false as const, error });

function quantity(value: unknown, { allowZero = false } = {}): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n > MAX_MOVEMENT_QUANTITY) return null;
  return n > 0 || (allowZero && n === 0) ? n : null;
}

function text(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.length > max ? undefined : trimmed;
}

// YYYY-MM-DD → UTC midnight (the @db.Date convention).
function calendarDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE_RE.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}

// When the movement happened: a date (YYYY-MM-DD, recorded at noon UTC so it stays on that
// day in every Cameroonian time zone) or now; never in the future.
function occurredAt(value: unknown, now: Date): Date | StockInputError {
  if (value === undefined || value === null || value === "") return now;
  const day = calendarDate(value);
  if (!day) return "invalid_date";
  const at = new Date(day.getTime() + 12 * 3600_000);
  if (day.getTime() > Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) return "future_date";
  return at > now ? now : at;
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

// Optional depot id: null when absent (the article's dispensing depot is used).
function optionalLocation(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return uuid(value) ?? undefined;
}

export interface ReceiptInput {
  locationId: string | null;
  lotNumber: string;
  expiryDate: Date | null;
  quantity: number;
  unitCost: number | null;
  supplierId: string | null;
  reason: string | null;
  occurredAt: Date;
}

export function parseReceipt(body: Record<string, unknown>, now = new Date()): Result<ReceiptInput> {
  const qty = quantity(body.quantity);
  if (qty === null) return fail("invalid_quantity");
  const lotNumber = text(body.lotNumber, MAX_LOT_NUMBER);
  if (!lotNumber) return fail("invalid_lot_number");
  const expiryDate = calendarDate(body.expiryDate);
  if (expiryDate === undefined) return fail("invalid_expiry_date");
  let unitCost: number | null = null;
  if (body.unitCost !== undefined && body.unitCost !== null && body.unitCost !== "") {
    const n = Number(body.unitCost);
    if (!Number.isFinite(n) || n < 0 || n > 1e10) return fail("invalid_unit_cost");
    unitCost = Math.round(n * 100) / 100;
  }
  const reason = text(body.reason, MAX_REASON);
  if (reason === undefined) return fail("invalid_reason");
  const at = occurredAt(body.occurredAt, now);
  if (typeof at === "string") return fail(at);
  const locationId = optionalLocation(body.locationId);
  if (locationId === undefined) return fail("invalid_location");
  return { ok: true, value: { locationId, lotNumber: lotNumber.toUpperCase(), expiryDate, quantity: qty, unitCost, supplierId: uuid(body.supplierId), reason, occurredAt: at } };
}

export interface LossInput {
  type: LossType;
  lotId: string | null;
  locationId: string | null;
  quantity: number;
  reason: string;
  occurredAt: Date;
}

// A loss always has a reason: it is what the RMA3 and the stock audit ask for.
export function parseLoss(body: Record<string, unknown>, now = new Date()): Result<LossInput> {
  if (!(LOSS_TYPES as readonly unknown[]).includes(body.type)) return fail("invalid_loss_type");
  const qty = quantity(body.quantity);
  if (qty === null) return fail("invalid_quantity");
  const lotId = body.lotId === undefined || body.lotId === null || body.lotId === "" ? null : uuid(body.lotId);
  if (lotId === null && body.lotId) return fail("invalid_lot");
  const reason = text(body.reason, MAX_REASON);
  if (reason === undefined) return fail("invalid_reason");
  if (!reason) return fail("reason_required");
  const at = occurredAt(body.occurredAt, now);
  if (typeof at === "string") return fail(at);
  const locationId = optionalLocation(body.locationId);
  if (locationId === undefined) return fail("invalid_location");
  return { ok: true, value: { type: body.type as LossType, lotId, locationId, quantity: qty, reason, occurredAt: at } };
}

export interface TransferInput {
  lotId: string;
  toLocationId: string;
  quantity: number;
  reason: string | null;
  occurredAt: Date;
}

// Moves part of one lot to another depot.
export function parseTransfer(body: Record<string, unknown>, now = new Date()): Result<TransferInput> {
  const lotId = uuid(body.lotId);
  if (!lotId) return fail("invalid_lot");
  const toLocationId = uuid(body.toLocationId);
  if (!toLocationId) return fail("invalid_location");
  const qty = quantity(body.quantity);
  if (qty === null) return fail("invalid_quantity");
  const reason = text(body.reason, MAX_REASON);
  if (reason === undefined) return fail("invalid_reason");
  const at = occurredAt(body.occurredAt, now);
  if (typeof at === "string") return fail(at);
  return { ok: true, value: { lotId, toLocationId, quantity: qty, reason, occurredAt: at } };
}

export interface CountInput {
  lotId: string;
  countedQuantity: number;
  reason: string;
}

// Physical inventory of one lot: the counted quantity replaces the book quantity.
export function parseCount(body: Record<string, unknown>): Result<CountInput> {
  const lotId = uuid(body.lotId);
  if (!lotId) return fail("invalid_lot");
  const counted = quantity(body.countedQuantity, { allowZero: true });
  if (counted === null) return fail("invalid_quantity");
  const reason = text(body.reason, MAX_REASON);
  if (reason === undefined) return fail("invalid_reason");
  if (!reason) return fail("reason_required");
  return { ok: true, value: { lotId, countedQuantity: counted, reason } };
}

export function isRma3StockCategory(value: unknown): value is Rma3StockCategory {
  return (RMA3_STOCK_CATEGORIES as readonly unknown[]).includes(value);
}

export interface ItemFields {
  name: string;
  manufacturer: string | null;
  category: string | null;
  threshold: number;
  unit: string | null;
  unitPrice: number | null;
  storageLocationId: string | null;
  supplierId: string | null;
  rma3Category: Rma3StockCategory | null;
  rma3Treatment: Rma3Treatment | null;
  vaccineAntigenCode: string | null;
  dosesPerUnit: number;
  openVialHours: number | null;
}

export type ItemFieldError =
  | "invalid_name"
  | "invalid_field"
  | "invalid_threshold"
  | "invalid_unit_price"
  | "invalid_rma3_category"
  | "invalid_rma3_treatment"
  | "invalid_doses_per_unit"
  | "open_vial_hours_required"
  | "stock_is_read_only";

// Largest vial in use (e.g. BCG 20 doses) with margin; 28 days after opening at most (WHO
// multi-dose vial policy for liquid vaccines).
const MAX_DOSES_PER_UNIT = 50;
const MAX_OPEN_VIAL_HOURS = 24 * 28;

// Article settings (creation: every field; update: only the fields present). The stock
// itself is never accepted here: it only changes through movements.
export function parseItemFields(
  body: Record<string, unknown>,
  { partial }: { partial: boolean }
): { ok: true; value: Partial<ItemFields> } | { ok: false; error: ItemFieldError } {
  if (partial && body.stock !== undefined) return { ok: false, error: "stock_is_read_only" };
  const value: Partial<ItemFields> = {};
  const has = (key: keyof ItemFields) => !partial || body[key] !== undefined;

  if (has("name")) {
    const name = text(body.name, 255);
    if (!name) return { ok: false, error: "invalid_name" };
    value.name = name;
  }
  for (const [key, max] of [["manufacturer", 255], ["category", 100], ["unit", 50], ["vaccineAntigenCode", 40]] as const) {
    if (!has(key)) continue;
    const v = text(body[key], max);
    if (v === undefined) return { ok: false, error: "invalid_field" };
    value[key] = v;
  }
  for (const key of ["storageLocationId", "supplierId"] as const) {
    if (!has(key)) continue;
    const raw = body[key];
    const id = raw === undefined || raw === null || raw === "" ? null : uuid(raw);
    if (id === null && raw) return { ok: false, error: "invalid_field" };
    value[key] = id;
  }
  if (has("threshold")) {
    const threshold = body.threshold === undefined || body.threshold === null || body.threshold === "" ? 0 : quantity(body.threshold, { allowZero: true });
    if (threshold === null) return { ok: false, error: "invalid_threshold" };
    value.threshold = threshold;
  }
  if (has("unitPrice")) {
    const raw = body.unitPrice;
    if (raw === undefined || raw === null || raw === "") value.unitPrice = null;
    else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 1e10) return { ok: false, error: "invalid_unit_price" };
      value.unitPrice = Math.round(n * 100) / 100;
    }
  }
  if (has("dosesPerUnit")) {
    const raw = body.dosesPerUnit;
    const doses = raw === undefined || raw === null || raw === "" ? 1 : quantity(raw);
    if (doses === null || doses > MAX_DOSES_PER_UNIT) return { ok: false, error: "invalid_doses_per_unit" };
    value.dosesPerUnit = doses;
  }
  if (has("openVialHours")) {
    const raw = body.openVialHours;
    const hours = raw === undefined || raw === null || raw === "" ? null : quantity(raw);
    if (hours === null && raw !== undefined && raw !== null && raw !== "") return { ok: false, error: "open_vial_hours_required" };
    if (hours !== null && hours > MAX_OPEN_VIAL_HOURS) return { ok: false, error: "open_vial_hours_required" };
    value.openVialHours = hours;
  }
  // A multi-dose vial must say how long it may be used once opened (no guessed default).
  if (value.dosesPerUnit !== undefined && value.dosesPerUnit > 1 && !value.openVialHours && !(partial && body.openVialHours === undefined)) {
    return { ok: false, error: "open_vial_hours_required" };
  }
  if (has("rma3Category")) {
    const raw = body.rma3Category;
    if (raw === undefined || raw === null || raw === "") value.rma3Category = null;
    else if (isRma3StockCategory(raw)) value.rma3Category = raw;
    else return { ok: false, error: "invalid_rma3_category" };
  }
  if (has("rma3Treatment")) {
    const raw = body.rma3Treatment;
    if (raw === undefined || raw === null || raw === "") value.rma3Treatment = null;
    else if ((RMA3_TREATMENTS as readonly unknown[]).includes(raw)) value.rma3Treatment = raw as Rma3Treatment;
    else return { ok: false, error: "invalid_rma3_treatment" };
  }
  return { ok: true, value };
}
