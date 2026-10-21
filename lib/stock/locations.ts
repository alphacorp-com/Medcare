import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

// Code of the depot created for articles that have none (same code as the migration
// 20261023090000_stock_depots_and_open_vials).
export const DEFAULT_LOCATION_CODE = "PRINCIPAL";
const DEFAULT_LOCATION_NAME = "Dépôt principal";

// The tenant's main depot, created on first use.
export async function ensureDefaultLocation(tx: Tx, tenantId: string): Promise<string> {
  const location = await tx.storageLocation.upsert({
    where: { tenantId_code: { tenantId, code: DEFAULT_LOCATION_CODE } },
    update: {},
    create: { tenantId, code: DEFAULT_LOCATION_CODE, name: DEFAULT_LOCATION_NAME },
    select: { id: true },
  });
  return location.id;
}

// Where an article is dispensed / vaccinated from: its storage location, or the main depot.
export async function dispensingLocationId(tx: Tx, tenantId: string, storageLocationId: string | null): Promise<string> {
  return storageLocationId ?? ensureDefaultLocation(tx, tenantId);
}
