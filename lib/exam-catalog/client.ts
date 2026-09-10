export type ExamCatalogItem = {
  code: string;
  label: string;
  parameters: { name: string; unit: string; referenceRange: string }[];
  modality: string;
  requiresContrast: boolean;
  price: number | null;
};

export const CUSTOM_EXAM_CODE = "CUSTOM";

// Fetches the tenant's configurable exam catalog (Settings → Exam Types), replacing the
// previously hardcoded lib/laboratory/panels.ts / lib/radiology/catalog.ts static arrays.
export async function fetchExamCatalog(domain: "laboratory" | "radiology"): Promise<ExamCatalogItem[]> {
  const res = await fetch(`/api/v1/exam-catalog?domain=${domain}`);
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}
