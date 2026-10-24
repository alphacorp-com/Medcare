import prisma from "@/lib/prisma";

// Ownership checks of the ids a coverage form refers to: each must belong to the facility.

// An item of this facility's insurance_type catalog (or none).
export async function isFacilityInsuranceType(tenantId: string, id: string | null | undefined): Promise<boolean> {
  if (!id) return true;
  return Boolean(await prisma.referenceCatalogItem.findFirst({ where: { id, tenantId, catalogType: "insurance_type" }, select: { id: true } }));
}

// Pharmacy articles of this facility.
export async function areFacilityArticles(tenantId: string, ids: readonly string[] | undefined): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  return (await prisma.medicationInventory.count({ where: { tenantId, id: { in: [...ids] } } })) === ids.length;
}

// The patient of the URL, in this facility.
export async function facilityPatient(tenantId: string, patientId: string) {
  return prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true } });
}
