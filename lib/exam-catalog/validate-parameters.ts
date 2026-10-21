import type { ExamParameterDefinition, SexReference } from "@/lib/exam-catalog/parameters";

// Server-side validation of an exam's result sheet (ExamCatalogEntry.parameters) before it
// is stored. These definitions drive the result entry forms and the automatic flags —
// including which results are reported as critical — so a malformed or contradictory
// definition (low > high, a "normal" answer that isn't a possible answer…) must be refused
// here, not discovered at the bench. Unknown keys are dropped; the result is normalized.

export const MAX_PARAMETERS = 150;
export const MAX_OPTIONS = 30;
const MAX_NAME = 120;
const MAX_SECTION = 80;
const MAX_UNIT = 40;
const MAX_REFERENCE = 160;
const MAX_OPTION = 60;

export type ParameterErrorCode =
  | "not_a_list"
  | "too_many"
  | "not_an_object"
  | "name_required"
  | "too_long"
  | "not_a_number"
  | "low_above_high"
  | "critical_inconsistent"
  | "numeric_and_options"
  | "options_invalid"
  | "options_duplicate"
  | "too_many_options"
  | "flag_option_unknown"
  | "flag_option_conflict"
  | "duplicate_name";

export type ParameterValidation =
  | { ok: true; value: ExamParameterDefinition[] }
  // `index` is the 0-based row at fault, absent for list-level errors.
  | { ok: false; code: ParameterErrorCode; index?: number };

class ParameterError extends Error {
  constructor(public code: ParameterErrorCode) {
    super(code);
  }
}

function text(value: unknown, max: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new ParameterError("name_required");
    return "";
  }
  if (typeof value !== "string") throw new ParameterError("too_long");
  const trimmed = value.trim();
  if (required && !trimmed) throw new ParameterError("name_required");
  if (trimmed.length > max) throw new ParameterError("too_long");
  return trimmed;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ParameterError("not_a_number");
  return value;
}

function checkInterval(low: number | undefined, high: number | undefined) {
  if (low !== undefined && high !== undefined && low > high) throw new ParameterError("low_above_high");
}

function sexReference(value: unknown): SexReference | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new ParameterError("not_an_object");
  const raw = value as Record<string, unknown>;
  const low = optionalNumber(raw.low);
  const high = optionalNumber(raw.high);
  checkInterval(low, high);
  return {
    referenceRange: text(raw.referenceRange, MAX_REFERENCE),
    ...(low !== undefined ? { low } : {}),
    ...(high !== undefined ? { high } : {}),
  };
}

function optionList(value: unknown, max = MAX_OPTIONS): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new ParameterError("options_invalid");
  const list = value.map((option) => {
    if (typeof option !== "string" || !option.trim()) throw new ParameterError("options_invalid");
    if (option.trim().length > MAX_OPTION) throw new ParameterError("too_long");
    return option.trim();
  });
  if (list.length > max) throw new ParameterError("too_many_options");
  if (new Set(list).size !== list.length) throw new ParameterError("options_duplicate");
  return list;
}

function parseOne(value: unknown): ExamParameterDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ParameterError("not_an_object");
  const raw = value as Record<string, unknown>;

  const name = text(raw.name, MAX_NAME, true);
  const section = text(raw.section, MAX_SECTION);
  const unit = text(raw.unit, MAX_UNIT);
  const referenceRange = text(raw.referenceRange, MAX_REFERENCE);

  const low = optionalNumber(raw.low);
  const high = optionalNumber(raw.high);
  const criticalLow = optionalNumber(raw.criticalLow);
  const criticalHigh = optionalNumber(raw.criticalHigh);
  checkInterval(low, high);
  // Panic values sit outside the normal interval.
  if (
    (criticalLow !== undefined && criticalHigh !== undefined && criticalLow >= criticalHigh) ||
    (criticalLow !== undefined && low !== undefined && criticalLow > low) ||
    (criticalHigh !== undefined && high !== undefined && criticalHigh < high)
  ) {
    throw new ParameterError("critical_inconsistent");
  }

  let bySex: ExamParameterDefinition["bySex"];
  if (raw.bySex !== undefined && raw.bySex !== null) {
    if (typeof raw.bySex !== "object" || Array.isArray(raw.bySex)) throw new ParameterError("not_an_object");
    const sexes = raw.bySex as Record<string, unknown>;
    const M = sexReference(sexes.M);
    const F = sexReference(sexes.F);
    if (M || F) bySex = { ...(M ? { M } : {}), ...(F ? { F } : {}) };
  }

  const options = optionList(raw.options);
  const normalOptions = optionList(raw.normalOptions);
  const criticalOptions = optionList(raw.criticalOptions);
  const hasNumeric = [low, high, criticalLow, criticalHigh].some((n) => n !== undefined) || Boolean(bySex);

  if (options?.length) {
    // deriveFlag ignores numeric bounds when answers are listed: refuse the ambiguity.
    if (hasNumeric) throw new ParameterError("numeric_and_options");
    const allowed = new Set(options);
    if ([...(normalOptions ?? []), ...(criticalOptions ?? [])].some((o) => !allowed.has(o))) {
      throw new ParameterError("flag_option_unknown");
    }
    if (normalOptions?.some((o) => criticalOptions?.includes(o))) throw new ParameterError("flag_option_conflict");
  } else if (normalOptions?.length || criticalOptions?.length) {
    throw new ParameterError("flag_option_unknown");
  }

  return {
    ...(section ? { section } : {}),
    name,
    unit,
    referenceRange,
    ...(low !== undefined ? { low } : {}),
    ...(high !== undefined ? { high } : {}),
    ...(criticalLow !== undefined ? { criticalLow } : {}),
    ...(criticalHigh !== undefined ? { criticalHigh } : {}),
    ...(bySex ? { bySex } : {}),
    ...(options?.length ? { options } : {}),
    ...(options?.length && normalOptions?.length ? { normalOptions } : {}),
    ...(options?.length && criticalOptions?.length ? { criticalOptions } : {}),
  };
}

export function validateExamParameters(input: unknown): ParameterValidation {
  if (!Array.isArray(input)) return { ok: false, code: "not_a_list" };
  if (input.length > MAX_PARAMETERS) return { ok: false, code: "too_many" };

  const value: ExamParameterDefinition[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index++) {
    try {
      const parameter = parseOne(input[index]);
      // Results are stored by name (and grouped by section): two identical rows would be
      // indistinguishable on the report.
      const identity = `${parameter.section ?? ""}\u0000${parameter.name.toLowerCase()}`;
      if (seen.has(identity)) return { ok: false, code: "duplicate_name", index };
      seen.add(identity);
      value.push(parameter);
    } catch (error) {
      if (error instanceof ParameterError) return { ok: false, code: error.code, index };
      throw error;
    }
  }
  return { ok: true, value };
}
