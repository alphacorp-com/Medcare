export type ResultFlag = "normal" | "high" | "low" | "critical";

export interface PanelParameterTemplate {
  name: string;
  unit: string;
  referenceRange: string;
}

export interface LabPanel {
  code: string;
  label: string;
  parameters: PanelParameterTemplate[];
}

/** Fixed catalog of common laboratory panels — not a configurable form builder. */
export const LAB_PANELS: LabPanel[] = [
  {
    code: "CBC",
    label: "Complete Blood Count (CBC)",
    parameters: [
      { name: "WBC", unit: "10^9/L", referenceRange: "4.0-11.0" },
      { name: "RBC", unit: "10^12/L", referenceRange: "4.2-5.9" },
      { name: "Hemoglobin", unit: "g/dL", referenceRange: "13.0-17.0" },
      { name: "Hematocrit", unit: "%", referenceRange: "38-50" },
      { name: "Platelets", unit: "10^9/L", referenceRange: "150-400" },
    ],
  },
  {
    code: "CMP",
    label: "Comprehensive Metabolic Panel (CMP)",
    parameters: [
      { name: "Glucose", unit: "mg/dL", referenceRange: "70-100" },
      { name: "Sodium", unit: "mmol/L", referenceRange: "135-145" },
      { name: "Potassium", unit: "mmol/L", referenceRange: "3.5-5.0" },
      { name: "Creatinine", unit: "mg/dL", referenceRange: "0.6-1.2" },
      { name: "BUN", unit: "mg/dL", referenceRange: "7-20" },
    ],
  },
  {
    code: "LIPID",
    label: "Lipid Panel",
    parameters: [
      { name: "Total Cholesterol", unit: "mg/dL", referenceRange: "< 200" },
      { name: "LDL", unit: "mg/dL", referenceRange: "< 100" },
      { name: "HDL", unit: "mg/dL", referenceRange: "> 40" },
      { name: "Triglycerides", unit: "mg/dL", referenceRange: "< 150" },
    ],
  },
  {
    code: "TROP-I",
    label: "Troponin I",
    parameters: [{ name: "Troponin I", unit: "ng/mL", referenceRange: "< 0.04" }],
  },
  {
    code: "UA",
    label: "Urinalysis",
    parameters: [
      { name: "pH", unit: "", referenceRange: "4.5-8" },
      { name: "Protein", unit: "mg/dL", referenceRange: "Negative" },
      { name: "Glucose", unit: "mg/dL", referenceRange: "Negative" },
      { name: "Leukocytes", unit: "", referenceRange: "Negative" },
    ],
  },
  {
    code: "HIV",
    label: "HIV Rapid Test",
    parameters: [{ name: "HIV", unit: "", referenceRange: "Non-reactive" }],
  },
  {
    code: "SYPH",
    label: "Syphilis (RPR/TPHA)",
    parameters: [{ name: "Syphilis", unit: "", referenceRange: "Non-reactive" }],
  },
];

export const CUSTOM_PANEL_CODE = "CUSTOM";

export function findPanel(code: string): LabPanel | undefined {
  return LAB_PANELS.find((p) => p.code === code);
}

export function generateExamCode(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `EX-${timestamp}-${random}`;
}
