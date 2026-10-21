import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lineUnits, parsePrescriptionLines, resolveLineArticle } from "@/lib/stock/prescription-items";

const ID = "3f2c1a9e-5b6d-4c7e-8f90-1a2b3c4d5e6f";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("parsePrescriptionLines", () => {
  it("requires a whole quantity for a stocked article", () => {
    assert.deepEqual(parsePrescriptionLines([{ drug: "Paracétamol", inventoryId: ID }]), { ok: false, error: "quantity_required", index: 0 });
    assert.deepEqual(parsePrescriptionLines([{ drug: "Paracétamol", inventoryId: ID, quantity: 2.5 }]), { ok: false, error: "invalid_quantity", index: 0 });
    const r = parsePrescriptionLines([{ drug: "Paracétamol", inventoryId: ID, quantity: "20", dosage: "1 cp" }]);
    assert.ok(r.ok);
    assert.deepEqual(r.lines[0], { drug: "Paracétamol", dosage: "1 cp", frequency: "", duration: "", inventoryId: ID, quantity: 20 });
  });

  it("keeps an unstocked drug as free text, without quantity", () => {
    const r = parsePrescriptionLines([{ drug: "Sirop X", inventoryId: null, quantity: 3 }]);
    assert.ok(r.ok);
    assert.equal(r.lines[0].inventoryId, null);
    assert.equal(r.lines[0].quantity, null);
  });

  it("rejects malformed lines", () => {
    assert.deepEqual(parsePrescriptionLines([]), { ok: false, error: "not_a_list" });
    assert.deepEqual(parsePrescriptionLines([{ drug: "" }]), { ok: false, error: "invalid_drug", index: 0 });
    assert.deepEqual(parsePrescriptionLines([{ drug: "A", inventoryId: "x" }]), { ok: false, error: "invalid_line", index: 0 });
  });
});

describe("resolveLineArticle", () => {
  const a = { id: ID, name: "Paracétamol 500mg" };
  const b = { id: OTHER, name: "Amoxicilline" };
  const byId = new Map([[ID, a], [OTHER, b]]);
  const byName = new Map([["paracétamol 500mg", a], ["amoxicilline", b]]);

  it("uses the linked article, never the name, for current lines", () => {
    assert.equal(resolveLineArticle({ drug: "Amoxicilline", inventoryId: ID }, byId, byName), a);
    assert.equal(resolveLineArticle({ drug: "Amoxicilline", inventoryId: null }, byId, byName), null);
  });

  it("falls back to the seed code, then the name, for pre-rule lines", () => {
    assert.equal(resolveLineArticle({ drugName: "x", drugCode: OTHER }, byId, byName), b);
    assert.equal(resolveLineArticle({ drug: "PARACÉTAMOL 500MG" }, byId, byName), a);
    assert.equal(resolveLineArticle({ drug: "Inconnu" }, byId, byName), null);
  });
});

describe("lineUnits", () => {
  it("rounds a fractional legacy quantity up and ignores missing ones", () => {
    assert.equal(lineUnits({ quantity: 2.5 }), 3);
    assert.equal(lineUnits({ quantity: "10" }), 10);
    assert.equal(lineUnits({}), 0);
  });
});
