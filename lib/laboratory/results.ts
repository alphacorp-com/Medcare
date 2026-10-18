// "abnormal" is for qualitative results (e.g. "Positif") that are out of range without
// being higher or lower than anything.
export type ResultFlag = "normal" | "high" | "low" | "abnormal" | "critical";

export interface ResultParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: ResultFlag;
  // Copied from the catalog definition so the report keeps its grouping.
  section?: string;
}

export interface ResultData {
  parameters: ResultParameter[];
}

export function computeIsCritical(parameters: ResultParameter[], explicit?: boolean): boolean {
  return Boolean(explicit) || parameters.some((p) => p.flag === "critical");
}
