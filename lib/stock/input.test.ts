import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCount, parseItemFields, parseLoss, parseReceipt, parseTransfer } from "@/lib/stock/input";

const now = new Date("2026-10-22T09:30:00Z");
const LOT_ID = "3f2c1a9e-5b6d-4c7e-8f90-1a2b3c4d5e6f";

describe("parseReceipt", () => {
  it("normalizes a valid receipt", () => {
    const r = parseReceipt({ lotNumber: " ab123 ", expiryDate: "2027-05-31", quantity: "120", unitCost: "250.456", occurredAt: "2026-10-20" }, now);
    assert.ok(r.ok);
    assert.equal(r.value.lotNumber, "AB123");
    assert.equal(r.value.quantity, 120);
    assert.equal(r.value.unitCost, 250.46);
    assert.equal(r.value.expiryDate?.toISOString(), "2027-05-31T00:00:00.000Z");
    assert.equal(r.value.occurredAt.toISOString(), "2026-10-20T12:00:00.000Z");
  });

  it("rejects bad quantities, dates and a missing lot number", () => {
    assert.deepEqual(parseReceipt({ lotNumber: "A", quantity: 0 }, now), { ok: false, error: "invalid_quantity" });
    assert.deepEqual(parseReceipt({ lotNumber: "A", quantity: 2.5 }, now), { ok: false, error: "invalid_quantity" });
    assert.deepEqual(parseReceipt({ lotNumber: "A", quantity: 2_000_000 }, now), { ok: false, error: "invalid_quantity" });
    assert.deepEqual(parseReceipt({ quantity: 5 }, now), { ok: false, error: "invalid_lot_number" });
    assert.deepEqual(parseReceipt({ lotNumber: "A", quantity: 5, expiryDate: "2027-02-30" }, now), { ok: false, error: "invalid_expiry_date" });
    assert.deepEqual(parseReceipt({ lotNumber: "A", quantity: 5, occurredAt: "2026-10-23" }, now), { ok: false, error: "future_date" });
    assert.deepEqual(parseReceipt({ lotNumber: "A", quantity: 5, unitCost: -1 }, now), { ok: false, error: "invalid_unit_cost" });
  });

  it("never dates today's receipt after now", () => {
    const r = parseReceipt({ lotNumber: "A", quantity: 5, occurredAt: "2026-10-22" }, now);
    assert.ok(r.ok);
    assert.equal(r.value.occurredAt.getTime(), now.getTime());
  });
});

describe("parseLoss", () => {
  it("requires a known type and a reason", () => {
    assert.deepEqual(parseLoss({ type: "stolen", quantity: 1, reason: "x" }, now), { ok: false, error: "invalid_loss_type" });
    assert.deepEqual(parseLoss({ type: "damaged", quantity: 1 }, now), { ok: false, error: "reason_required" });
    assert.deepEqual(parseLoss({ type: "damaged", quantity: 1, reason: "x", lotId: "not-a-uuid" }, now), { ok: false, error: "invalid_lot" });
    const r = parseLoss({ type: "expired", quantity: 4, reason: "Lot périmé", lotId: LOT_ID }, now);
    assert.ok(r.ok);
    assert.equal(r.value.lotId, LOT_ID);
  });
});

describe("parseCount", () => {
  it("accepts a zero count but requires a lot and a reason", () => {
    assert.ok(parseCount({ lotId: LOT_ID, countedQuantity: 0, reason: "Inventaire mensuel" }).ok);
    assert.deepEqual(parseCount({ lotId: LOT_ID, countedQuantity: -2, reason: "x" }), { ok: false, error: "invalid_quantity" });
    assert.deepEqual(parseCount({ lotId: LOT_ID, countedQuantity: 3 }), { ok: false, error: "reason_required" });
  });
});

describe("parseItemFields", () => {
  it("refuses a direct stock change on update", () => {
    assert.deepEqual(parseItemFields({ stock: 50 }, { partial: true }), { ok: false, error: "stock_is_read_only" });
  });

  it("validates the RMA3 category and numbers", () => {
    assert.deepEqual(parseItemFields({ name: "ASAQ", rma3Category: "cosmetics" }, { partial: false }), { ok: false, error: "invalid_rma3_category" });
    assert.deepEqual(parseItemFields({ name: "ASAQ", threshold: -1 }, { partial: false }), { ok: false, error: "invalid_threshold" });
    assert.deepEqual(parseItemFields({ name: "  " }, { partial: false }), { ok: false, error: "invalid_name" });
    const r = parseItemFields({ name: "VPO", rma3Category: "epi_input", vaccineAntigenCode: "VPO", unitPrice: "", threshold: "20" }, { partial: false });
    assert.ok(r.ok);
    assert.equal(r.value.rma3Category, "epi_input");
    assert.equal(r.value.unitPrice, null);
    assert.equal(r.value.threshold, 20);
  });

  it("only touches the fields sent on update", () => {
    const r = parseItemFields({ threshold: 5 }, { partial: true });
    assert.deepEqual(r, { ok: true, value: { threshold: 5 } });
  });
});

describe("parseTransfer", () => {
  it("requires a lot, a destination depot and a quantity", () => {
    assert.deepEqual(parseTransfer({ toLocationId: LOT_ID, quantity: 1 }, now), { ok: false, error: "invalid_lot" });
    assert.deepEqual(parseTransfer({ lotId: LOT_ID, quantity: 1 }, now), { ok: false, error: "invalid_location" });
    assert.ok(parseTransfer({ lotId: LOT_ID, toLocationId: LOT_ID, quantity: 4 }, now).ok);
  });
});

describe("multi-dose vials", () => {
  it("require the use-by time of an opened vial", () => {
    assert.deepEqual(parseItemFields({ name: "VPO", dosesPerUnit: 20 }, { partial: false }), { ok: false, error: "open_vial_hours_required" });
    assert.deepEqual(parseItemFields({ name: "VPO", dosesPerUnit: 0 }, { partial: false }), { ok: false, error: "invalid_doses_per_unit" });
    const r = parseItemFields({ name: "VPO", dosesPerUnit: 20, openVialHours: 672 }, { partial: false });
    assert.ok(r.ok);
    assert.equal(r.value.dosesPerUnit, 20);
  });
});
