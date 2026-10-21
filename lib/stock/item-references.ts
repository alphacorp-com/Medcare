import prisma from "@/lib/prisma";
import type { ItemFields } from "@/lib/stock/input";

export type ItemReferenceError = "unknown_storage_location" | "unknown_supplier" | "unknown_vaccine_antigen";

// An article may only point to the tenant's own storage location, supplier and vaccine
// antigen (the ids come from the browser).
export async function checkItemReferences(tenantId: string, fields: Partial<ItemFields>): Promise<ItemReferenceError | null> {
  const [location, supplier, antigen] = await Promise.all([
    fields.storageLocationId ? prisma.storageLocation.findFirst({ where: { id: fields.storageLocationId, tenantId }, select: { id: true } }) : true,
    fields.supplierId ? prisma.supplier.findFirst({ where: { id: fields.supplierId, tenantId }, select: { id: true } }) : true,
    fields.vaccineAntigenCode
      ? prisma.referenceCatalogItem.findFirst({ where: { tenantId, catalogType: "vaccine_antigen", code: fields.vaccineAntigenCode }, select: { id: true } })
      : true,
  ]);
  if (!location) return "unknown_storage_location";
  if (!supplier) return "unknown_supplier";
  if (!antigen) return "unknown_vaccine_antigen";
  return null;
}
