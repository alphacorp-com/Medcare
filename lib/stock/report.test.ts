import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStockReport, countStockoutDays, type ReportLot, type ReportMovement } from "@/lib/stock/report";

const at = (iso: string) => new Date(`${iso}Z`);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
// October 2026 report, CMM window from August.
const windowStart = day("2026-08-01");
const start = day("2026-10-01");
const end = day("2026-11-01");
const afterMonth = at("2026-11-15T10:00:00");

const mv = (lotId: string, type: ReportMovement["type"], quantity: number, iso: string): ReportMovement => ({ itemId: "A", lotId, type, quantity, occurredAt: at(iso) });

describe("buildStockReport", () => {
  const lots: ReportLot[] = [
    { id: "L1", itemId: "A", expiryDate: day("2027-06-30"), balanceBefore: 100 },
    { id: "L2", itemId: "A", expiryDate: day("2026-10-15"), balanceBefore: 0 },
  ];
  const movements: ReportMovement[] = [
    mv("L1", "dispensing", -30, "2026-08-10T09:00:00"),
    mv("L1", "dispensing", -30, "2026-09-10T09:00:00"),
    mv("L2", "receipt", 20, "2026-10-02T09:00:00"),
    mv("L1", "dispensing", -25, "2026-10-05T09:00:00"),
    mv("L1", "vaccination", -5, "2026-10-06T09:00:00"),
    mv("L2", "expired", -20, "2026-10-20T09:00:00"),
    mv("L1", "adjustment", -2, "2026-10-21T09:00:00"),
    mv("L1", "transfer_out", -10, "2026-10-22T09:00:00"),
    mv("L1", "transfer_in", 10, "2026-10-22T09:00:00"),
    mv("L1", "dispensing", -1, "2026-11-02T09:00:00"), // next month: ignored
  ];
  const [row] = buildStockReport({ itemIds: ["A"], lots, movements, windowStart, start, end, now: afterMonth, firstMovementAt: new Map([["A", day("2026-01-01")]]) });

  it("balances the month: opening + entries - exits ± adjustments = closing", () => {
    assert.equal(row.opening, 40);
    assert.equal(row.received, 20);
    assert.equal(row.consumed, 30);
    assert.deepEqual(row.losses, { expired: 20, damaged: 0, lost: 0 });
    assert.equal(row.adjusted, -2);
    assert.equal(row.closing, 8);
  });

  it("averages the consumption of the last three months", () => {
    assert.equal(row.cmm, 30); // (30 + 30 + 30) / 3
  });

  it("averages over fewer months for an article that started recently", () => {
    // First movement on Sept 10: the August dispensing does not exist for this article.
    const [recent] = buildStockReport({ itemIds: ["A"], lots, movements: movements.slice(1), windowStart, start, end, now: afterMonth, firstMovementAt: new Map([["A", at("2026-09-10T09:00:00")]]) });
    assert.equal(recent.cmm, 30); // (30 + 30) / 2
  });
});

describe("countStockoutDays", () => {
  it("counts the days ending without non-expired stock", () => {
    const lots: ReportLot[] = [
      { id: "L1", itemId: "A", expiryDate: null, balanceBefore: 5 },
      { id: "L2", itemId: "A", expiryDate: day("2026-10-10"), balanceBefore: 50 },
    ];
    const movements = [mv("L1", "dispensing", -5, "2026-10-03T15:00:00"), mv("L1", "receipt", 10, "2026-10-25T08:00:00")];
    // L1 empty from Oct 3 to Oct 24; L2 still holds stock but is expired from Oct 11:
    // stockout Oct 11 → Oct 24 = 14 days.
    assert.equal(countStockoutDays(lots, movements, start, end, afterMonth), 14);
  });

  it("stops at today for the current month", () => {
    const lots: ReportLot[] = [{ id: "L1", itemId: "A", expiryDate: null, balanceBefore: 0 }];
    assert.equal(countStockoutDays(lots, [], start, end, at("2026-10-05T10:00:00")), 5);
  });
});
