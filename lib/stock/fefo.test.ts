import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fefoOrder, isExpired, planFefo, type LotBalance } from "@/lib/stock/fefo";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = new Date("2026-10-22T09:30:00Z");
const lot = (id: string, quantity: number, expiry: string | null): LotBalance => ({ id, lotNumber: id.toUpperCase(), quantity, expiryDate: expiry ? d(expiry) : null });

describe("isExpired", () => {
  it("lets a lot be used on its expiry date and not after", () => {
    assert.equal(isExpired(d("2026-10-22"), today), false);
    assert.equal(isExpired(d("2026-10-21"), today), true);
    assert.equal(isExpired(null, today), false);
  });
});

describe("fefoOrder", () => {
  it("puts the earliest expiry first and lots without expiry last", () => {
    const ordered = fefoOrder([lot("c", 1, null), lot("b", 1, "2027-03-01"), lot("a", 1, "2026-12-01")]);
    assert.deepEqual(ordered.map((l) => l.id), ["a", "b", "c"]);
  });
});

describe("planFefo", () => {
  const lots = [lot("late", 10, "2027-06-30"), lot("soon", 3, "2026-11-30"), lot("expired", 50, "2026-09-30"), lot("empty", 0, "2026-10-31")];

  it("takes from the lot expiring first, then the next one", () => {
    assert.deepEqual(planFefo(lots, 5, today), { ok: true, allocations: [{ lotId: "soon", quantity: 3 }, { lotId: "late", quantity: 2 }] });
  });

  it("never hands out expired stock, and reports what is really available", () => {
    assert.deepEqual(planFefo(lots, 14, today), { ok: false, available: 13 });
  });

  it("can take expired stock when destroying it", () => {
    const plan = planFefo(lots, 50, today, { allowExpired: true });
    assert.deepEqual(plan, { ok: true, allocations: [{ lotId: "expired", quantity: 50 }] });
  });

  it("refuses zero, negative and fractional quantities", () => {
    for (const quantity of [0, -1, 1.5]) assert.equal(planFefo(lots, quantity, today).ok, false);
  });
});
