import prisma from "@/lib/prisma";
import { isExpired } from "@/lib/stock/fefo";

// Stock that can actually be handed to a patient: non-expired lots of the article's
// dispensing depot. The article's `stock` counts every depot and expired lots still on the
// shelf, so it can't tell whether a prescription will be dispensable.
export async function loadDispensableStock(
  tenantId: string,
  items: readonly { id: string; storageLocationId: string | null }[],
  at = new Date()
): Promise<Map<string, number>> {
  const result = new Map(items.map((i) => [i.id, 0]));
  if (items.length === 0) return result;
  const lots = await prisma.stockLot.findMany({
    where: {
      tenantId,
      quantity: { gt: 0 },
      OR: items.map((i) => (i.storageLocationId ? { itemId: i.id, locationId: i.storageLocationId } : { itemId: i.id })),
    },
    select: { itemId: true, expiryDate: true, quantity: true },
  });
  for (const lot of lots) {
    if (!isExpired(lot.expiryDate, at)) result.set(lot.itemId, (result.get(lot.itemId) ?? 0) + lot.quantity);
  }
  return result;
}
