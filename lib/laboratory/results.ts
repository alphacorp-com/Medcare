export type ResultFlag = "normal" | "high" | "low" | "critical";

export interface ResultParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: ResultFlag;
}

export interface ResultData {
  parameters: ResultParameter[];
}

export function computeIsCritical(parameters: ResultParameter[], explicit?: boolean): boolean {
  return Boolean(explicit) || parameters.some((p) => p.flag === "critical");
}
