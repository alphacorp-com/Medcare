import { formatIcd10Ranges, parseIcd10Ranges } from "@/lib/diagnoses/icd10-ranges";

// Validation of an administrator's edit of an RMA3 cause rubric. Pure, unit-tested in
// rubric-update.test.ts. The ICD-10 list is stored in canonical form ("B50-B54, A39").

const MAX_LABEL = 255;
const MAX_ORDER = 999;

export interface RubricUpdate {
  label?: string;
  icd10Ranges?: string;
  isActive?: boolean;
  order?: number;
}

export type RubricUpdateResult =
  | { ok: true; value: RubricUpdate }
  | { ok: false; error: "invalid_label" | "invalid_ranges" | "invalid_order" | "invalid_flag" | "empty_update"; token?: string };

export function parseRubricUpdate(input: unknown): RubricUpdateResult {
  if (typeof input !== "object" || input === null) return { ok: false, error: "empty_update" };
  const body = input as Record<string, unknown>;
  const value: RubricUpdate = {};

  if (body.label !== undefined) {
    if (typeof body.label !== "string" || !body.label.trim() || body.label.trim().length > MAX_LABEL) return { ok: false, error: "invalid_label" };
    value.label = body.label.trim();
  }
  if (body.icd10Ranges !== undefined) {
    if (typeof body.icd10Ranges !== "string") return { ok: false, error: "invalid_ranges" };
    const parsed = parseIcd10Ranges(body.icd10Ranges);
    if (!parsed.ok) return { ok: false, error: "invalid_ranges", token: parsed.token };
    value.icd10Ranges = formatIcd10Ranges(parsed.items);
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return { ok: false, error: "invalid_flag" };
    value.isActive = body.isActive;
  }
  if (body.order !== undefined) {
    if (typeof body.order !== "number" || !Number.isInteger(body.order) || body.order < 0 || body.order > MAX_ORDER) {
      return { ok: false, error: "invalid_order" };
    }
    value.order = body.order;
  }
  return Object.keys(value).length > 0 ? { ok: true, value } : { ok: false, error: "empty_update" };
}
