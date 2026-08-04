export type Modality = "xray" | "ct" | "mri" | "ultrasound" | "mammography";

export interface RadiologyExamCatalogEntry {
  code: string;
  label: string;
  modality: Modality;
  requiresContrast: boolean;
}

/** Fixed catalog of common imaging exams — not a configurable form builder. */
export const RADIOLOGY_CATALOG: RadiologyExamCatalogEntry[] = [
  { code: "XR-CHEST", label: "Chest X-ray (2 views)", modality: "xray", requiresContrast: false },
  { code: "XR-EXT", label: "Extremity X-ray", modality: "xray", requiresContrast: false },
  { code: "CT-HEAD", label: "CT Head without contrast", modality: "ct", requiresContrast: false },
  { code: "CT-ABD-CONTRAST", label: "CT Abdomen/Pelvis with contrast", modality: "ct", requiresContrast: true },
  { code: "CT-CHEST-CONTRAST", label: "CT Chest with contrast", modality: "ct", requiresContrast: true },
  { code: "MRI-BRAIN", label: "MRI Brain without contrast", modality: "mri", requiresContrast: false },
  { code: "MRI-SPINE-CONTRAST", label: "MRI Spine with gadolinium", modality: "mri", requiresContrast: true },
  { code: "US-ABD", label: "Ultrasound Abdomen", modality: "ultrasound", requiresContrast: false },
  { code: "US-PELVIS", label: "Ultrasound Pelvis", modality: "ultrasound", requiresContrast: false },
  { code: "MMG-SCREEN", label: "Screening Mammography", modality: "mammography", requiresContrast: false },
];

export const CUSTOM_EXAM_CODE = "CUSTOM";

export function findExam(code: string): RadiologyExamCatalogEntry | undefined {
  return RADIOLOGY_CATALOG.find((e) => e.code === code);
}

export function generateExamCode(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `RAD-${timestamp}-${random}`;
}
