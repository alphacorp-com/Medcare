import prisma from "@/lib/prisma";

// The Td (tetanus-diphtheria) antigen of the facility's vaccine catalog: the first active item
// of the TD group, or code TD. Created on first use (code TD, group TD) so that recording a Td
// dose at an antenatal visit never depends on a settings step; the facility can rename it or
// link it to a stock article in Settings > Vaccine antigens.
export const TD_GROUP = "TD";

// Read-only lookup (null when the facility has no Td antigen yet).
export function findTdAntigen(tenantId: string): Promise<{ code: string; nameFr: string } | null> {
  return prisma.referenceCatalogItem.findFirst({
    where: {
      catalogType: "vaccine_antigen",
      isActive: true,
      OR: [{ tenantId }, { tenantId: null }],
      AND: [{ OR: [{ group: { equals: TD_GROUP, mode: "insensitive" } }, { code: TD_GROUP }] }],
    },
    orderBy: [{ tenantId: { sort: "desc", nulls: "last" } }, { order: "asc" }],
    select: { code: true, nameFr: true },
  });
}

export async function ensureTdAntigen(tenantId: string): Promise<{ code: string; nameFr: string }> {
  const existing = await findTdAntigen(tenantId);
  if (existing) return existing;
  return prisma.referenceCatalogItem.upsert({
    where: { tenantId_catalogType_code: { tenantId, catalogType: "vaccine_antigen", code: TD_GROUP } },
    create: { tenantId, catalogType: "vaccine_antigen", code: TD_GROUP, nameFr: "Td (tétanos-diphtérie)", nameEn: "Td (tetanus-diphtheria)", group: TD_GROUP, order: 29 },
    // An inactive TD item: reactivated rather than duplicated.
    update: { isActive: true },
    select: { code: true, nameFr: true },
  });
}
