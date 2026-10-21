import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { fefoOrder, isExpired } from "@/lib/stock/fefo";
import { StockError, consumeStock, lockItem } from "@/lib/stock/movements";

// Vaccines in stock: an article whose vaccineAntigenCode is set supplies the doses of that
// antigen from its dispensing depot. A stock unit is a vial of `dosesPerUnit` doses:
//  - single-dose: each vaccination takes one unit from the lot;
//  - multi-dose: the first vaccination opens a vial (one unit leaves the stock), the next
//    ones use its remaining doses until it is empty or `openVialHours` have passed. Doses
//    left in a vial that expired or was discarded are the EPI wastage (see the report).

type Tx = Prisma.TransactionClient;

export interface OpenVialInfo {
  id: string;
  dosesLeft: number;
  discardAt: Date;
}

export interface VaccineLot {
  id: string;
  itemId: string;
  itemName: string;
  lotNumber: string;
  expiryDate: Date | null;
  // Unopened units (vials) left, doses per unit, and the vial currently open on this lot.
  quantity: number;
  dosesPerUnit: number;
  openVial: OpenVialInfo | null;
}

// Closes the vials whose use-by time has passed (they keep their unused doses as wastage).
// Lazily called before reading or using open vials.
export async function closeExpiredVials(db: Tx | typeof prisma, tenantId: string, now: Date) {
  const expired = await db.stockOpenVial.findMany({
    where: { tenantId, closedAt: null, discardAt: { lte: now } },
    select: { id: true, discardAt: true },
  });
  for (const vial of expired) {
    await db.stockOpenVial.updateMany({ where: { id: vial.id, closedAt: null }, data: { closedAt: vial.discardAt, closedReason: "expired" } });
  }
}

// `managed` is true as soon as one active article is linked to the antigen, even when none
// of its lots is usable: the vaccination must then wait for a receipt (no stock, no dose).
export async function loadVaccineStock(tenantId: string, antigenCode: string, at: Date): Promise<{ managed: boolean; lots: VaccineLot[] }> {
  const items = await prisma.medicationInventory.findMany({
    where: { tenantId, isActive: true, vaccineAntigenCode: antigenCode },
    select: { id: true, name: true, storageLocationId: true, dosesPerUnit: true },
  });
  if (items.length === 0) return { managed: false, lots: [] };

  await closeExpiredVials(prisma, tenantId, at);
  const byId = new Map(items.map((i) => [i.id, i]));
  // Only the dispensing depot of each article supplies vaccinations (every article has one
  // since the depots migration; lib/stock/locations).
  const depotFilters = items.map((i) => (i.storageLocationId ? { itemId: i.id, locationId: i.storageLocationId } : { itemId: i.id }));
  const lots = await prisma.stockLot.findMany({
    where: { tenantId, OR: depotFilters },
    select: {
      id: true,
      itemId: true,
      lotNumber: true,
      expiryDate: true,
      quantity: true,
      openVials: {
        where: { closedAt: null, discardAt: { gt: at } },
        orderBy: { openedAt: "asc" },
        take: 1,
        select: { id: true, dosesPerVial: true, dosesUsed: true, discardAt: true },
      },
    },
  });

  const usable = lots
    .filter((lot) => !isExpired(lot.expiryDate, at))
    .map(({ openVials, ...lot }) => {
      const vial = openVials[0];
      return {
        ...lot,
        itemName: byId.get(lot.itemId)?.name ?? "",
        dosesPerUnit: byId.get(lot.itemId)?.dosesPerUnit ?? 1,
        openVial: vial ? { id: vial.id, dosesLeft: vial.dosesPerVial - vial.dosesUsed, discardAt: vial.discardAt } : null,
      };
    })
    .filter((lot) => lot.quantity > 0 || (lot.openVial && lot.openVial.dosesLeft > 0));
  // Lots with an open vial first (use it before opening another), then FEFO.
  const ordered = fefoOrder(usable);
  return { managed: true, lots: [...ordered.filter((l) => l.openVial), ...ordered.filter((l) => !l.openVial)] };
}

export interface AdministerDoseInput {
  tenantId: string;
  userId: string;
  itemId: string;
  lotId: string;
  immunizationId: string;
  at: Date;
}

export interface AdministeredDose {
  lotNumber: string;
  expiryDate: Date | null;
  openVialId: string | null;
}

// Takes one dose from the lot, inside the vaccination's transaction.
export async function administerVaccineDose(tx: Tx, input: AdministerDoseInput): Promise<AdministeredDose> {
  const item = await lockItem(tx, input.tenantId, input.itemId);
  const lot = await tx.stockLot.findFirst({ where: { id: input.lotId, itemId: item.id }, select: { id: true, lotNumber: true, expiryDate: true } });
  if (!lot) throw new StockError("lot_not_found");
  if (isExpired(lot.expiryDate, input.at)) throw new StockError("lot_expired");

  const consumeOneUnit = (sourceType: string, sourceId: string) =>
    consumeStock(
      tx,
      { tenantId: input.tenantId, userId: input.userId, itemId: item.id, lotId: lot.id, quantity: 1, type: "vaccination", sourceType, sourceId, occurredAt: input.at },
      item
    );

  if (item.dosesPerUnit <= 1) {
    await consumeOneUnit("immunization", input.immunizationId);
    return { lotNumber: lot.lotNumber, expiryDate: lot.expiryDate, openVialId: null };
  }

  await closeExpiredVials(tx, input.tenantId, new Date());
  // A vial of this lot open at the time of the dose, with doses left.
  const vial = await tx.stockOpenVial.findFirst({
    where: { lotId: lot.id, closedAt: null, openedAt: { lte: input.at }, discardAt: { gt: input.at } },
    orderBy: { openedAt: "asc" },
  });
  if (vial && vial.dosesUsed < vial.dosesPerVial) {
    const dosesUsed = vial.dosesUsed + 1;
    const emptied = dosesUsed === vial.dosesPerVial;
    // Conditional on the count read under the article lock: never more doses than the vial holds.
    const updated = await tx.stockOpenVial.updateMany({
      where: { id: vial.id, dosesUsed: vial.dosesUsed, closedAt: null },
      data: { dosesUsed, ...(emptied ? { closedAt: input.at, closedReason: "emptied" } : {}) },
    });
    if (updated.count === 1) return { lotNumber: lot.lotNumber, expiryDate: lot.expiryDate, openVialId: vial.id };
  }

  // Open a new vial: one unit leaves the stock now, the other doses wait in the vial.
  // The use-by time is required for multi-dose articles (lib/stock/input): never guessed.
  if (!item.openVialHours) throw new StockError("vial_config_missing", { itemName: item.name });
  const hours = item.openVialHours;
  const vialId = randomUUID();
  await consumeOneUnit("open_vial", vialId);
  await tx.stockOpenVial.create({
    data: {
      id: vialId,
      tenantId: input.tenantId,
      itemId: item.id,
      lotId: lot.id,
      dosesPerVial: item.dosesPerUnit,
      dosesUsed: 1,
      openedAt: input.at,
      discardAt: new Date(input.at.getTime() + hours * 3_600_000),
      openedById: input.userId,
    },
  });
  return { lotNumber: lot.lotNumber, expiryDate: lot.expiryDate, openVialId: vialId };
}

// Closes an open vial before its use-by time (end of session, contamination…): its
// remaining doses count as wasted.
export async function discardOpenVial(tenantId: string, vialId: string): Promise<boolean> {
  const result = await prisma.stockOpenVial.updateMany({
    where: { id: vialId, tenantId, closedAt: null },
    data: { closedAt: new Date(), closedReason: "discarded" },
  });
  return result.count === 1;
}
