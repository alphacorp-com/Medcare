import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RMA3_MANUAL_INDICATORS, RMA3_MANUAL_SECTIONS } from "@/lib/rma3-manual/catalog";
import { daysInPeriod, parseIdentification, parsePeriod, parseReopenReason, parseValueChanges, readIdentification } from "@/lib/rma3-manual/input";

const now = new Date("2026-10-22T10:00:00Z");

describe("RMA3 manual catalog", () => {
  it("has unique codes, income and expense rows kept apart", () => {
    const codes = RMA3_MANUAL_SECTIONS.flatMap((s) => s.indicators.map((i) => i.code));
    assert.equal(new Set(codes).size, codes.length);
    assert.equal(RMA3_MANUAL_INDICATORS.get("VI.3-001")?.label, "Solde du mois précédent");
    assert.equal(RMA3_MANUAL_INDICATORS.get("VI.3-D001")?.label, "Salaires payés par l'État");
  });

  it("leaves out the income the billing will produce", () => {
    for (const code of ["VI.3-003", "VI.3-005", "VI.3-009", "VI.3-019", "VI.3-021"]) assert.equal(RMA3_MANUAL_INDICATORS.has(code), false, code);
  });
});

describe("parsePeriod", () => {
  it("accepts a past or current YYYYMM", () => {
    assert.deepEqual(parsePeriod("202610", now), { ok: true, value: "202610" });
    assert.deepEqual(parsePeriod("202512", now), { ok: true, value: "202512" });
  });
  it("refuses a malformed or future month", () => {
    assert.deepEqual(parsePeriod("2026-10", now), { ok: false, error: "invalid_period" });
    assert.deepEqual(parsePeriod("202613", now), { ok: false, error: "invalid_period" });
    assert.deepEqual(parsePeriod(null, now), { ok: false, error: "invalid_period" });
    assert.deepEqual(parsePeriod("202611", now), { ok: false, error: "future_period" });
  });
  it("knows the length of the month", () => {
    assert.equal(daysInPeriod("202602"), 28);
    assert.equal(daysInPeriod("202410"), 31);
  });
});

describe("parseValueChanges", () => {
  const parse = (values: unknown[]) => parseValueChanges({ values }, "202602");

  it("accepts known cells, and null to clear one", () => {
    assert.deepEqual(
      parse([
        { code: "III.1-003", key: "planned", value: 4 },
        { code: "VI.1-001", key: "", value: 1 },
        { code: "VI.3-D008", key: "", value: 1_250_000 },
        { code: "II.1.4-002", key: "F", value: null },
      ]),
      {
        ok: true,
        value: [
          { code: "III.1-003", key: "planned", value: 4 },
          { code: "VI.1-001", key: "", value: 1 },
          { code: "VI.3-D008", key: "", value: 1_250_000 },
          { code: "II.1.4-002", key: "F", value: null },
        ],
      }
    );
  });

  it("refuses unknown indicators or breakdown cells", () => {
    assert.deepEqual(parse([{ code: "VI.3-009", key: "", value: 1 }]), { ok: false, error: "unknown_indicator" });
    assert.deepEqual(parse([{ code: "III.1-003", key: "", value: 1 }]), { ok: false, error: "unknown_breakdown" });
    assert.deepEqual(parse([{ code: "II.1.4-002", key: "U", value: 1 }]), { ok: false, error: "unknown_breakdown" });
  });

  it("refuses negative, decimal, out-of-range or non-numeric values", () => {
    assert.equal(parse([{ code: "VI.2-001", key: "", value: -1 }]).ok, false);
    assert.equal(parse([{ code: "VI.2-001", key: "", value: 1.5 }]).ok, false);
    assert.equal(parse([{ code: "VI.2-001", key: "", value: "3" }]).ok, false);
    assert.equal(parse([{ code: "VI.1-001", key: "", value: 2 }]).ok, false); // yes / no
    assert.equal(parse([{ code: "VI.4-002", key: "", value: 29 }]).ok, false); // February: 28 days
    assert.equal(parse([{ code: "VI.4-002", key: "", value: 28 }]).ok, true);
  });

  it("refuses an empty, oversized or duplicated batch", () => {
    assert.deepEqual(parseValueChanges({ values: [] }, "202602"), { ok: false, error: "invalid_body" });
    assert.deepEqual(parseValueChanges(null, "202602"), { ok: false, error: "invalid_body" });
    assert.deepEqual(parse(Array.from({ length: 1001 }, () => ({ code: "VI.2-001", key: "", value: 1 }))), { ok: false, error: "invalid_body" });
    assert.deepEqual(parse([{ code: "VI.2-001", key: "", value: 1 }, { code: "VI.2-001", key: "", value: 2 }]), { ok: false, error: "duplicate_cell" });
  });
});

describe("parseReopenReason", () => {
  it("needs 5 to 500 characters", () => {
    assert.deepEqual(parseReopenReason({ reason: "  Erreur de saisie VI.3  " }), { ok: true, value: "Erreur de saisie VI.3" });
    assert.equal(parseReopenReason({ reason: "oups" }).ok, false);
    assert.equal(parseReopenReason({ reason: "x".repeat(501) }).ok, false);
    assert.equal(parseReopenReason({}).ok, false);
  });
});

describe("parseIdentification", () => {
  it("trims, turns empty fields into null and checks each field", () => {
    const parsed = parseIdentification({ region: " Centre ", district: "", villagesServed: 12, villagesOutreach: 4, ownership: "faith_based", dataManagerPhone: "+237 6 99 00 11 22" });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.region, "Centre");
    assert.equal(parsed.value.district, null);
    assert.equal(parsed.value.ownership, "faith_based");
  });

  it("refuses inconsistent or malformed values", () => {
    assert.deepEqual(parseIdentification({ villagesServed: 3, villagesOutreach: 4 }), { ok: false, error: "invalid_villagesOutreach" });
    assert.deepEqual(parseIdentification({ ownership: "state" }), { ok: false, error: "invalid_ownership" });
    assert.deepEqual(parseIdentification({ dataManagerPhone: "<script>" }), { ok: false, error: "invalid_dataManagerPhone" });
    assert.deepEqual(parseIdentification({ region: "x".repeat(101) }), { ok: false, error: "invalid_region" });
  });

  it("reads back a stored value field by field, dropping what is malformed", () => {
    const read = readIdentification({ region: "Littoral", ownership: "state", villagesServed: -2 });
    assert.equal(read.region, "Littoral");
    assert.equal(read.ownership, null);
    assert.equal(read.villagesServed, null);
    assert.equal(readIdentification(null).region, null);
  });
});
