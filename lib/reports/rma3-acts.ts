// RMA3 indicators that count ACTS (not diagnoses). A medical act of the facility's catalog is
// linked to one of them in Settings > Medical acts (MedicalAct.rma3Indicator); the act chosen
// at admission (Stay.medicalActCode) and completed surgical procedures whose code is that of
// the act are counted. Codes are those of the RMA3 dictionary: add codes, never rename one.

export interface Rma3ActIndicator {
  code: string;
  label: string;
  section: "II.2" | "IV.4.10" | "IV.4.11";
}

export const RMA3_ACT_INDICATORS: readonly Rma3ActIndicator[] = [
  { code: "II.2-001", label: "Dépistage du cancer du col (femmes de 30-49 ans)", section: "II.2" },
  { code: "IV.4.10-003", label: "Cataracte opérée", section: "IV.4.10" },
  { code: "IV.4.11-011", label: "Extraction dentaire", section: "IV.4.11" },
  { code: "IV.4.11-012", label: "Soins conservateurs", section: "IV.4.11" },
  { code: "IV.4.11-013", label: "Pulpectomie", section: "IV.4.11" },
  { code: "IV.4.11-014", label: "Détartrage", section: "IV.4.11" },
  { code: "IV.4.11-015", label: "Dévitalisation", section: "IV.4.11" },
];

export function isRma3ActIndicator(value: unknown): value is string {
  return typeof value === "string" && RMA3_ACT_INDICATORS.some((i) => i.code === value);
}

// Body value → stored value: null to clear, a known code, or "invalid".
export function parseRma3ActIndicator(value: unknown): string | null | "invalid" {
  if (value === null || value === "") return null;
  return isRma3ActIndicator(value) ? value : "invalid";
}
