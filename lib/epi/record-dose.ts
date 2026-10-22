import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { administerVaccineDose } from "@/lib/stock/vaccines";

// Recording one vaccine dose, shared by the vaccination register and the antenatal visit (Td).
// Stock is optional: only an antigen supplied from the stock (an active article with
// vaccineAntigenCode = antigen) needs a lot, taken from that article in the same transaction.

type Tx = Prisma.TransactionClient;

export type StockLotCheck = { ok: true; lot: { id: string; itemId: string } | null } | { ok: false; code: "stock_lot_required" | "lot_not_found" };

export async function resolveVaccineStockLot(tenantId: string, antigenCode: string, stockLotId: unknown): Promise<StockLotCheck> {
  const stockItems = await prisma.medicationInventory.findMany({
    where: { tenantId, isActive: true, vaccineAntigenCode: antigenCode },
    select: { id: true },
  });
  if (stockItems.length === 0) return { ok: true, lot: null };
  if (typeof stockLotId !== "string" || !stockLotId) return { ok: false, code: "stock_lot_required" };
  const lot = await prisma.stockLot.findFirst({
    where: { id: stockLotId, tenantId, itemId: { in: stockItems.map((i) => i.id) } },
    select: { id: true, itemId: true },
  });
  return lot ? { ok: true, lot } : { ok: false, code: "lot_not_found" };
}

// Creates the Immunization inside `tx`. With a stock lot, one dose is taken from it (a unit,
// or the next dose of an open multi-dose vial) and the lot number / expiry come from the lot,
// never from the browser. Throws StockError on a stock problem.
export async function createImmunizationInTx(
  tx: Tx,
  data: Prisma.ImmunizationUncheckedCreateInput & { id: string; tenantId: string; administeredAt: Date },
  stockLot: { id: string; itemId: string } | null,
  userId: string
) {
  if (!stockLot) return tx.immunization.create({ data });
  const dose = await administerVaccineDose(tx, {
    tenantId: data.tenantId,
    userId,
    itemId: stockLot.itemId,
    lotId: stockLot.id,
    immunizationId: data.id,
    at: data.administeredAt,
  });
  return tx.immunization.create({
    data: { ...data, stockLotId: stockLot.id, stockOpenVialId: dose.openVialId, lotNumber: dose.lotNumber, expiryDate: dose.expiryDate },
  });
}
