import type { ResultFlag } from "@/lib/laboratory/results";

// One line of an exam's result sheet, as configured on its catalog entry
// (ExamCatalogEntry.parameters): what the technician measures or observes, the reference
// the result is read against, and enough structure to flag the result automatically.
// Every field beyond name/unit/referenceRange is optional, so entries created before this
// (or typed by hand in Settings) keep working as plain free-text rows.
export interface SexReference {
  referenceRange: string;
  low?: number;
  high?: number;
}

export interface ExamParameterDefinition {
  name: string;
  unit: string;
  // Shown to the technician and printed on the report, e.g. "4,0 – 10,0" or "Négatif".
  referenceRange: string;
  // Groups rows on the entry form and the report (e.g. "Cytologie", "Bandelette urinaire").
  section?: string;
  // Numeric results: normal interval, and the panic values that make a result critical.
  low?: number;
  high?: number;
  criticalLow?: number;
  criticalHigh?: number;
  // Sex-specific reference (haemoglobin, creatinine…) overriding referenceRange/low/high.
  bySex?: { M?: SexReference; F?: SexReference };
  // Qualitative results: the allowed answers, which of them are normal, and which are
  // critical (anything else listed is flagged abnormal).
  options?: string[];
  normalOptions?: string[];
  criticalOptions?: string[];
}

export function resolveReference(def: ExamParameterDefinition, gender?: string | null): SexReference {
  const sexRef = gender === "M" || gender === "F" ? def.bySex?.[gender] : undefined;
  return sexRef ?? { referenceRange: def.referenceRange, low: def.low, high: def.high };
}

// "4,5" and "4.5" both parse; "< 10" or "10^5" don't — those stay manually flagged.
function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

// Suggested flag for a result. Returns null when the definition gives nothing to compare
// against, leaving the flag to the technician.
export function deriveFlag(def: ExamParameterDefinition, value: string, gender?: string | null): ResultFlag | null {
  if (!value.trim()) return null;

  if (def.options?.length) {
    if (def.criticalOptions?.includes(value)) return "critical";
    if (def.normalOptions?.length) return def.normalOptions.includes(value) ? "normal" : "abnormal";
    return null;
  }

  const numeric = parseNumber(value);
  if (numeric === null) return null;
  if (def.criticalLow !== undefined && numeric < def.criticalLow) return "critical";
  if (def.criticalHigh !== undefined && numeric > def.criticalHigh) return "critical";

  const { low, high } = resolveReference(def, gender);
  if (low === undefined && high === undefined) return null;
  if (low !== undefined && numeric < low) return "low";
  if (high !== undefined && numeric > high) return "high";
  return "normal";
}
