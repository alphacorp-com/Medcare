import prisma from "@/lib/prisma";
import type { Rma3StockCategory } from "@/lib/stock/input";
import { buildStockReport, monthStart, type StockReportRow } from "@/lib/stock/report";
import { closeExpiredVials } from "@/lib/stock/vaccines";

// Loads the journal of a month (and the two before, for the CMM) and builds the monthly
// stock report; adds the EPI figures of multi-dose vaccines.

export interface StockReportItemRow extends StockReportRow {
  name: string;
  unit: string | null;
  rma3Category: Rma3StockCategory | null;
  // Vaccines only (null otherwise): doses given from the stock, vials opened, doses left in
  // vials that expired or were discarded during the month, and the wastage rate.
  vaccine: { dosesAdministered: number; vialsOpened: number; dosesWasted: number; wastageRate: number | null } | null;
}

export interface StockReport {
  period: string;
  rows: StockReportItemRow[];
}

const PERIOD_RE = /^(\d{4})(0[1-9]|1[0-2])$/;

export function parseStockPeriod(period: string): { start: Date; end: Date; windowStart: Date } | null {
  const match = PERIOD_RE.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return { start: monthStart(year, month), end: monthStart(year, month + 1), windowStart: monthStart(year, month - 2) };
}

export async function computeStockReport(tenantId: string, period: string, now = new Date()): Promise<StockReport | null> {
  const range = parseStockPeriod(period);
  if (!range) return null;
  const { start, end, windowStart } = range;

  const items = await prisma.medicationInventory.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, rma3Category: true, vaccineAntigenCode: true },
  });
  const itemIds = items.map((i) => i.id);
  if (itemIds.length === 0) return { period, rows: [] };

  await closeExpiredVials(prisma, tenantId, now);
  const [lots, before, movements, firsts, vialsOpened, vialsClosed, doses] = await Promise.all([
    prisma.stockLot.findMany({ where: { tenantId, itemId: { in: itemIds } }, select: { id: true, itemId: true, expiryDate: true } }),
    prisma.stockMovement.groupBy({ by: ["lotId"], where: { tenantId, itemId: { in: itemIds }, occurredAt: { lt: windowStart } }, _sum: { quantity: true } }),
    prisma.stockMovement.findMany({
      where: { tenantId, itemId: { in: itemIds }, occurredAt: { gte: windowStart, lt: end } },
      select: { itemId: true, lotId: true, type: true, quantity: true, occurredAt: true },
    }),
    prisma.stockMovement.groupBy({ by: ["itemId"], where: { tenantId, itemId: { in: itemIds } }, _min: { occurredAt: true } }),
    prisma.stockOpenVial.groupBy({ by: ["itemId"], where: { tenantId, openedAt: { gte: start, lt: end } }, _count: true }),
    prisma.stockOpenVial.findMany({
      where: { tenantId, closedAt: { gte: start, lt: end }, closedReason: { in: ["expired", "discarded"] } },
      select: { itemId: true, dosesPerVial: true, dosesUsed: true },
    }),
    prisma.immunization.findMany({
      where: { tenantId, administeredAt: { gte: start, lt: end }, stockLotId: { not: null } },
      select: { stockLot: { select: { itemId: true } } },
    }),
  ]);

  const balanceBefore = new Map(before.map((b) => [b.lotId, b._sum.quantity ?? 0]));
  const rows = buildStockReport({
    itemIds,
    lots: lots.map((lot) => ({ ...lot, balanceBefore: balanceBefore.get(lot.id) ?? 0 })),
    movements,
    windowStart,
    start,
    end,
    now,
    firstMovementAt: new Map(firsts.filter((f) => f._min.occurredAt).map((f) => [f.itemId, f._min.occurredAt!])),
  });

  const opened = new Map(vialsOpened.map((v) => [v.itemId, v._count]));
  const wasted = new Map<string, number>();
  for (const vial of vialsClosed) wasted.set(vial.itemId, (wasted.get(vial.itemId) ?? 0) + vial.dosesPerVial - vial.dosesUsed);
  const administered = new Map<string, number>();
  for (const dose of doses) {
    const itemId = dose.stockLot?.itemId;
    if (itemId) administered.set(itemId, (administered.get(itemId) ?? 0) + 1);
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  return {
    period,
    rows: rows.map((row) => {
      const item = byId.get(row.itemId)!;
      const isVaccine = Boolean(item.vaccineAntigenCode);
      const dosesAdministered = administered.get(row.itemId) ?? 0;
      const dosesWasted = wasted.get(row.itemId) ?? 0;
      return {
        ...row,
        name: item.name,
        unit: item.unit,
        rma3Category: (item.rma3Category as Rma3StockCategory | null) ?? null,
        vaccine: isVaccine
          ? {
              dosesAdministered,
              vialsOpened: opened.get(row.itemId) ?? 0,
              dosesWasted,
              // Share of the doses taken out of vials that were not given.
              wastageRate: dosesAdministered + dosesWasted > 0 ? Math.round((dosesWasted / (dosesAdministered + dosesWasted)) * 1000) / 10 : null,
            }
          : null,
      };
    }),
  };
}
