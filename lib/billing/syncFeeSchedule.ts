import prisma from "@/lib/prisma";

// Keeps the "exam" FeeSchedule row for a labo/radio/medical-act catalog code in sync with
// that catalog entry's own price — suggestInvoiceLine (lib/billing/suggestCharge.ts) looks
// up FeeSchedule exclusively, it never reads ExamCatalogEntry.price / MedicalAct.basePrice
// directly, so without this a tenant configuring a price on the catalog entry had no effect
// on what actually gets billed. Never throws — this is a side effect of catalog maintenance,
// not a precondition for it.
//
// Note: ExamCatalogEntry and MedicalAct each have their own tenant-scoped unique `code`, but
// nothing stops the two catalogs from picking the same code for unrelated items — since both
// land in the same FeeSchedule (tenantId, "exam", code) slot, a collision would make one
// silently overwrite the other's price. Worth a uniqueness check across both catalogs if this
// becomes a real problem; not attempted here.
export async function syncExamFeeSchedule(params: {
  tenantId: string;
  code: string;
  label: string;
  price: number | null;
  isActive: boolean;
}): Promise<void> {
  const { tenantId, code, label, price, isActive } = params;
  try {
    if (price == null) {
      // No price configured on the catalog entry — deactivate any stale FeeSchedule row
      // rather than leaving (or inventing) a price that no longer reflects the catalog.
      await prisma.feeSchedule.updateMany({
        where: { tenantId, sourceType: "exam", code },
        data: { isActive: false },
      });
      return;
    }

    await prisma.feeSchedule.upsert({
      where: { tenantId_sourceType_code: { tenantId, sourceType: "exam", code } },
      update: { label, unitPrice: price, isActive },
      create: { tenantId, sourceType: "exam", code, label, unitPrice: price, isActive },
    });
  } catch (error) {
    console.error("[syncExamFeeSchedule] Failed to sync fee schedule:", error);
  }
}

// Called when a catalog entry's code is renamed, or the entry is deleted — the FeeSchedule
// row under the old code would otherwise be orphaned (still active, no longer backed by
// anything a doctor can select).
export async function deactivateExamFeeSchedule(tenantId: string, code: string): Promise<void> {
  try {
    await prisma.feeSchedule.updateMany({
      where: { tenantId, sourceType: "exam", code },
      data: { isActive: false },
    });
  } catch (error) {
    console.error("[deactivateExamFeeSchedule] Failed to deactivate fee schedule:", error);
  }
}
