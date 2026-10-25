import prisma from "@/lib/prisma";

// A medical act (MedicalAct) and a lab / radiology exam (ExamCatalogEntry) are priced in the
// same tariff-grid slot, FeeSchedule (tenant, "exam", code) — see lib/billing/syncFeeSchedule.ts.
// The same code in both catalogs would make one silently overwrite the other's price, so each
// catalog refuses a code the other already uses. Codes are stored upper-cased by both.
export type FeeCatalog = "medical_act" | "exam_entry";

export async function feeCodeUsedByOtherCatalog(tenantId: string, code: string, catalog: FeeCatalog): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  const other =
    catalog === "medical_act"
      ? await prisma.examCatalogEntry.findFirst({ where: { tenantId, code: normalized }, select: { id: true } })
      : await prisma.medicalAct.findFirst({ where: { tenantId, code: normalized }, select: { id: true } });
  return Boolean(other);
}

export const FEE_CODE_CONFLICT = "fee_code_conflict";
