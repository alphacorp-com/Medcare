import prisma from "@/lib/prisma";
import { fefoOrder, isExpired } from "@/lib/stock/fefo";

// Vaccines in stock: an article whose vaccineAntigenCode is set supplies the doses of that
// antigen, one dose per vaccination.

export interface VaccineLot {
  id: string;
  itemId: string;
  itemName: string;
  lotNumber: string;
  expiryDate: Date | null;
  quantity: number;
}

// `managed` is true as soon as one active article is linked to the antigen, even when none
// of its lots is usable: the vaccination must then wait for a receipt (no stock, no dose).
export async function loadVaccineStock(tenantId: string, antigenCode: string, at: Date): Promise<{ managed: boolean; lots: VaccineLot[] }> {
  const items = await prisma.medicationInventory.findMany({
    where: { tenantId, isActive: true, vaccineAntigenCode: antigenCode },
    select: { id: true, name: true },
  });
  if (items.length === 0) return { managed: false, lots: [] };

  const names = new Map(items.map((i) => [i.id, i.name]));
  const lots = await prisma.stockLot.findMany({
    where: { tenantId, itemId: { in: items.map((i) => i.id) }, quantity: { gt: 0 } },
    select: { id: true, itemId: true, lotNumber: true, expiryDate: true, quantity: true },
  });
  const usable = fefoOrder(lots.filter((lot) => !isExpired(lot.expiryDate, at)));
  return { managed: true, lots: usable.map((lot) => ({ ...lot, itemName: names.get(lot.itemId) ?? "" })) };
}
