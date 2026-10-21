import type { StockMovementType } from "@prisma/client";
import { isExpired } from "@/lib/stock/fefo";

// Monthly stock report per article, from the stock journal. Pure, unit-tested in
// report.test.ts. All depots together (transfers cancel out at the article level).
//
//  - opening / closing: stock at the first / last instant of the month;
//  - received: receipts; consumed: dispensings + vaccinations (vials opened);
//  - losses: expired, damaged, lost; adjusted: inventory counts (and the opening balance
//    when the stock journal starts during the month), signed;
//  - CMM (consommation moyenne mensuelle): consumption of the month and the two before,
//    divided by the number of those months the article existed in the journal (1 to 3);
//  - stockout days: days of the month (up to today) ending with no USABLE stock, i.e. no
//    non-expired lot left. Days are UTC calendar days, like the report periods.

export interface ReportMovement {
  itemId: string;
  lotId: string | null;
  type: StockMovementType;
  quantity: number;
  occurredAt: Date;
}

export interface ReportLot {
  id: string;
  itemId: string;
  expiryDate: Date | null;
  // Sum of the lot's movements before the window start (see buildStockReport).
  balanceBefore: number;
}

export interface StockReportRow {
  itemId: string;
  opening: number;
  received: number;
  consumed: number;
  losses: { expired: number; damaged: number; lost: number };
  adjusted: number;
  closing: number;
  cmm: number;
  stockoutDays: number;
}

const CONSUMPTION: ReadonlySet<StockMovementType> = new Set(["dispensing", "vaccination"]);
const DAY = 86_400_000;

export function monthStart(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

export interface BuildStockReportInput {
  itemIds: readonly string[];
  // Lot balances before `windowStart` and every movement in [windowStart, end).
  lots: readonly ReportLot[];
  movements: readonly ReportMovement[];
  windowStart: Date; // start of the CMM window (two months before `start`)
  start: Date;
  end: Date;
  now: Date;
  // First movement date of each article (to know how many months it existed).
  firstMovementAt: ReadonlyMap<string, Date>;
}

export function buildStockReport(input: BuildStockReportInput): StockReportRow[] {
  const { start, end, now, windowStart } = input;
  const byItem = new Map<string, ReportMovement[]>();
  for (const m of input.movements) {
    const list = byItem.get(m.itemId) ?? [];
    list.push(m);
    byItem.set(m.itemId, list);
  }
  const lotsByItem = new Map<string, ReportLot[]>();
  for (const lot of input.lots) {
    const list = lotsByItem.get(lot.itemId) ?? [];
    list.push(lot);
    lotsByItem.set(lot.itemId, list);
  }

  return input.itemIds.map((itemId) => {
    const movements = (byItem.get(itemId) ?? []).slice().sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const lots = lotsByItem.get(itemId) ?? [];
    const balanceBeforeWindow = lots.reduce((sum, lot) => sum + lot.balanceBefore, 0);

    const row: StockReportRow = {
      itemId,
      opening: balanceBeforeWindow,
      received: 0,
      consumed: 0,
      losses: { expired: 0, damaged: 0, lost: 0 },
      adjusted: 0,
      closing: 0,
      cmm: 0,
      stockoutDays: 0,
    };

    let windowConsumption = 0;
    for (const m of movements) {
      if (m.occurredAt < start) {
        row.opening += m.quantity;
        if (CONSUMPTION.has(m.type)) windowConsumption -= m.quantity;
        continue;
      }
      if (m.occurredAt >= end) continue;
      if (m.type === "receipt") row.received += m.quantity;
      else if (CONSUMPTION.has(m.type)) row.consumed -= m.quantity;
      else if (m.type === "expired" || m.type === "damaged" || m.type === "lost") row.losses[m.type] -= m.quantity;
      else if (m.type === "adjustment" || m.type === "opening_balance") row.adjusted += m.quantity;
      // transfer_out / transfer_in: same article, net zero.
    }
    windowConsumption += row.consumed;
    row.closing = row.opening + row.received - row.consumed - row.losses.expired - row.losses.damaged - row.losses.lost + row.adjusted;

    // Months of the window (1 to 3) during which the article existed in the journal.
    const first = input.firstMovementAt.get(itemId);
    let months = 3;
    if (first && first > windowStart) {
      months = (start.getUTCFullYear() - first.getUTCFullYear()) * 12 + (start.getUTCMonth() - first.getUTCMonth()) + 1;
      months = Math.min(3, Math.max(1, months));
    }
    row.cmm = first ? Math.round((windowConsumption / months) * 10) / 10 : 0;

    row.stockoutDays = countStockoutDays(lots, movements, start, end, now);
    return row;
  });
}

// Days of [start, min(end, end of today)) whose closing usable stock is 0.
export function countStockoutDays(lots: readonly ReportLot[], movements: readonly ReportMovement[], start: Date, end: Date, now: Date): number {
  const balances = new Map(lots.map((lot) => [lot.id, lot.balanceBefore]));
  const sorted = movements.filter((m) => m.lotId).slice().sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const lastDay = Math.min(end.getTime(), today + DAY);

  let index = 0;
  let days = 0;
  for (let dayStart = start.getTime(); dayStart < lastDay; dayStart += DAY) {
    const dayEnd = dayStart + DAY;
    while (index < sorted.length && sorted[index].occurredAt.getTime() < dayEnd) {
      const m = sorted[index++];
      balances.set(m.lotId!, (balances.get(m.lotId!) ?? 0) + m.quantity);
    }
    const day = new Date(dayStart);
    const usable = lots.reduce((sum, lot) => (isExpired(lot.expiryDate, day) ? sum : sum + Math.max(0, balances.get(lot.id) ?? 0)), 0);
    if (usable <= 0) days += 1;
  }
  return days;
}
