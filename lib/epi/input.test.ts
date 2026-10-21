import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAefiInput, parseEquipmentInput, parseReadingInput, parseSessionInput, parseSessionStatus } from "@/lib/epi/input";

const now = new Date("2026-10-24T10:00:00Z");
const ID = "3f2c1a9e-5b6d-4c7e-8f90-1a2b3c4d5e6f";

describe("parseSessionInput", () => {
  it("requires a date, a strategy and a site", () => {
    assert.deepEqual(parseSessionInput({ scheduledDate: "2026-02-30", strategy: "fixed", site: "CSI" }), { ok: false, error: "invalid_date" });
    assert.deepEqual(parseSessionInput({ scheduledDate: "2026-10-30", strategy: "mobile", site: "CSI" }), { ok: false, error: "invalid_strategy" });
    assert.deepEqual(parseSessionInput({ scheduledDate: "2026-10-30", strategy: "outreach", site: " " }), { ok: false, error: "invalid_site" });
    const r = parseSessionInput({ scheduledDate: "2026-10-30", strategy: "outreach", site: " Village Nkol " });
    assert.ok(r.ok);
    assert.equal(r.value.site, "Village Nkol");
  });

  it("knows the session statuses", () => {
    assert.ok(parseSessionStatus("held").ok);
    assert.deepEqual(parseSessionStatus("done"), { ok: false, error: "invalid_status" });
  });
});

describe("parseAefiInput", () => {
  const valid = { immunizationId: ID, onsetAt: "2026-10-23T08:00:00Z", seriousness: "minor", description: "Fièvre 39 °C" };

  it("accepts a minor AEFI with an unknown outcome by default", () => {
    const r = parseAefiInput(valid, now);
    assert.ok(r.ok);
    assert.equal(r.value.outcome, "unknown");
    assert.equal(r.value.hospitalized, false);
  });

  it("rejects a future onset, an unknown seriousness and an empty description", () => {
    assert.deepEqual(parseAefiInput({ ...valid, onsetAt: "2026-10-25T08:00:00Z" }, now), { ok: false, error: "future_date" });
    assert.deepEqual(parseAefiInput({ ...valid, seriousness: "moderate" }, now), { ok: false, error: "invalid_seriousness" });
    assert.deepEqual(parseAefiInput({ ...valid, description: "" }, now), { ok: false, error: "invalid_description" });
    assert.deepEqual(parseAefiInput({ ...valid, immunizationId: "x" }, now), { ok: false, error: "invalid_immunization" });
  });
});

describe("parseEquipmentInput", () => {
  it("uses the standard range of the equipment type when none is given", () => {
    const fridge = parseEquipmentInput({ code: "rf-01", type: "refrigerator", label: "Réfrigérateur PEV" });
    assert.ok(fridge.ok);
    assert.equal(fridge.value.code, "RF-01");
    assert.deepEqual([fridge.value.minTempC, fridge.value.maxTempC], [2, 8]);
    const freezer = parseEquipmentInput({ code: "CG", type: "freezer", label: "Congélateur" });
    assert.ok(freezer.ok);
    assert.deepEqual([freezer.value.minTempC, freezer.value.maxTempC], [-25, -15]);
  });

  it("rejects an inverted range and an unknown type", () => {
    assert.deepEqual(parseEquipmentInput({ code: "A", type: "refrigerator", label: "x", minTempC: 8, maxTempC: 2 }), { ok: false, error: "invalid_range" });
    assert.deepEqual(parseEquipmentInput({ code: "A", type: "oven", label: "x" }), { ok: false, error: "invalid_type" });
  });
});

describe("parseReadingInput", () => {
  it("accepts a comma decimal and refuses impossible temperatures", () => {
    const r = parseReadingInput({ equipmentId: ID, temperatureC: "4,56" }, now);
    assert.ok(r.ok);
    assert.equal(r.value.temperatureC, 4.6);
    assert.equal(r.value.readAt, now);
    assert.deepEqual(parseReadingInput({ equipmentId: ID, temperatureC: 90 }, now), { ok: false, error: "invalid_temperature" });
    assert.deepEqual(parseReadingInput({ equipmentId: "x", temperatureC: 4 }, now), { ok: false, error: "invalid_equipment" });
  });
});
