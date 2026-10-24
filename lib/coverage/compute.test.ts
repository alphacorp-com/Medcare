import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { capProportionally, computeInvoiceCoverage, patientShare, programApplies, type CoverageLine, type CoverageTerms, type ProgramRule } from "@/lib/coverage/compute";

const line = (id: string, amount: number, family: CoverageLine["family"], o: Partial<CoverageLine> = {}): CoverageLine => ({ id, amount, family, code: null, inventoryItemId: null, ...o });
const adult = { ageMonths: 400, sex: "M", pregnant: false };
const child = { ageMonths: 30, sex: "F", pregnant: false };
const terms = (o: Partial<CoverageTerms> = {}): CoverageTerms => ({
  valid: true, defaultRate: 80, rates: {}, perInvoiceCeiling: null, annualRemaining: null, requiresAuthorization: false, authorizationThreshold: null, authorization: null, ...o,
});
const program = (o: Partial<ProgramRule> = {}): ProgramRule => ({
  id: "p", code: "PALU5", rate: 100, families: ["laboratory", "pharmacy"], actCodes: [], inventoryItemIds: [], eligibility: "automatic",
  minAgeMonths: null, maxAgeMonths: 60, sex: null, pregnantOnly: false, enrolled: false, ...o,
});

describe("payer share", () => {
  it("applies the family rate, else the default rate, rounded to the franc", () => {
    const r = computeInvoiceCoverage({
      lines: [line("c", 5000, "consultation"), line("x", 3333, "pharmacy")],
      patient: adult, programs: [], coverage: terms({ rates: { pharmacy: 50 } }),
    });
    assert.deepEqual(r.lines.map((l) => l.payerAmount), [4000, 1667]);
    assert.equal(r.payerAmount, 5667);
    assert.equal(r.outcome, "applied");
  });
  it("gives nothing for an invalid coverage, and 'none' without coverage", () => {
    assert.equal(computeInvoiceCoverage({ lines: [line("c", 5000, "consultation")], patient: adult, programs: [], coverage: terms({ valid: false }) }).payerAmount, 0);
    assert.equal(computeInvoiceCoverage({ lines: [line("c", 5000, "consultation")], patient: adult, programs: [], coverage: terms({ valid: false }) }).outcome, "invalid_coverage");
    assert.equal(computeInvoiceCoverage({ lines: [line("c", 5000, "consultation")], patient: adult, programs: [], coverage: null }).outcome, "none");
  });
  it("ignores zero and negative lines", () => {
    const r = computeInvoiceCoverage({ lines: [line("a", 0, "other"), line("b", -500, "other")], patient: adult, programs: [], coverage: terms() });
    assert.equal(r.payerAmount, 0);
  });
});

describe("ceilings and authorization", () => {
  it("caps the payer share at the lowest ceiling, spread proportionally", () => {
    const r = computeInvoiceCoverage({
      lines: [line("a", 10000, "consultation"), line("b", 30000, "surgery")],
      patient: adult, programs: [], coverage: terms({ defaultRate: 100, perInvoiceCeiling: 25000, annualRemaining: 20000 }),
    });
    assert.equal(r.payerAmount, 20000);
    assert.deepEqual(r.lines.map((l) => l.payerAmount), [5000, 15000]);
    assert.equal(r.outcome, "capped");
  });
  it("an exhausted annual ceiling leaves everything to the patient", () => {
    const r = computeInvoiceCoverage({ lines: [line("a", 10000, "consultation")], patient: adult, programs: [], coverage: terms({ annualRemaining: -500 }) });
    assert.equal(r.payerAmount, 0);
    assert.equal(r.outcome, "capped");
  });
  it("requires a valid authorization above the threshold only", () => {
    const base = { patient: adult, programs: [] };
    const small = computeInvoiceCoverage({ ...base, lines: [line("a", 10000, "consultation")], coverage: terms({ requiresAuthorization: true, authorizationThreshold: 50000 }) });
    assert.equal(small.payerAmount, 8000);
    const big = computeInvoiceCoverage({ ...base, lines: [line("a", 100000, "surgery")], coverage: terms({ requiresAuthorization: true, authorizationThreshold: 50000 }) });
    assert.equal(big.payerAmount, 0);
    assert.equal(big.outcome, "authorization_required");
    const authorized = computeInvoiceCoverage({ ...base, lines: [line("a", 100000, "surgery")], coverage: terms({ requiresAuthorization: true, authorizationThreshold: 50000, authorization: { valid: true, remaining: 60000 } }) });
    assert.equal(authorized.payerAmount, 60000);
    assert.equal(authorized.outcome, "capped");
    const expired = computeInvoiceCoverage({ ...base, lines: [line("a", 100000, "surgery")], coverage: terms({ requiresAuthorization: true, authorization: { valid: false, remaining: null } }) });
    assert.equal(expired.outcome, "authorization_required");
  });
});

describe("nomenclature rates and family ceiling", () => {
  it("uses the act's nomenclature rate before the family rate, only when the convention applies it", () => {
    const lines = [line("c", 10000, "consultation", { nomenclatureRate: 100 }), line("x", 10000, "consultation", { nomenclatureRate: null })];
    const applied = computeInvoiceCoverage({ lines, patient: adult, programs: [], coverage: terms({ useNomenclatureRates: true, rates: { consultation: 60 } }) });
    assert.deepEqual(applied.lines.map((l) => l.payerAmount), [10000, 6000]);
    const ignored = computeInvoiceCoverage({ lines, patient: adult, programs: [], coverage: terms({ useNomenclatureRates: false, rates: { consultation: 60 } }) });
    assert.deepEqual(ignored.lines.map((l) => l.payerAmount), [6000, 6000]);
    // A 0 % nomenclature rate means "not covered", not "not set".
    const zero = computeInvoiceCoverage({ lines: [line("z", 5000, "consultation", { nomenclatureRate: 0 })], patient: adult, programs: [], coverage: terms({ useNomenclatureRates: true }) });
    assert.equal(zero.payerAmount, 0);
  });
  it("limits the payer share by what is left of the family ceiling", () => {
    const r = computeInvoiceCoverage({ lines: [line("a", 50000, "surgery")], patient: adult, programs: [], coverage: terms({ annualRemaining: 100000, familyRemaining: 15000 }) });
    assert.equal(r.payerAmount, 15000);
    assert.equal(r.outcome, "capped");
  });
  it("reports a dependant over the age limit", () => {
    const r = computeInvoiceCoverage({ lines: [line("a", 5000, "consultation")], patient: adult, programs: [], coverage: terms({ valid: false, invalidReason: "age_limit" }) });
    assert.equal(r.outcome, "age_limit_exceeded");
    assert.equal(r.payerAmount, 0);
  });
});

describe("free-care programmes", () => {
  it("pays first, the payer covers its rate of the rest", () => {
    const r = computeInvoiceCoverage({
      lines: [line("tdr", 1000, "laboratory"), line("act", 2000, "pharmacy"), line("c", 5000, "consultation")],
      patient: child, programs: [program()], coverage: terms(),
    });
    assert.deepEqual(r.lines.map((l) => [l.exemptionAmount, l.payerAmount]), [[1000, 0], [2000, 0], [0, 4000]]);
    assert.equal(r.lines[0].exemptionProgramId, "p");
    assert.equal(patientShare(8000, r.payerAmount, r.exemptionAmount, 0), 1000);
  });
  it("checks age, sex, pregnancy, codes, articles and enrolment", () => {
    const lab = line("l", 1000, "laboratory", { code: "TDR" });
    assert.equal(programApplies(program(), adult, lab), false);
    assert.equal(programApplies(program({ maxAgeMonths: null, sex: "F" }), adult, lab), false);
    assert.equal(programApplies(program({ maxAgeMonths: null, pregnantOnly: true }), { ...adult, pregnant: true }, lab), true);
    assert.equal(programApplies(program({ actCodes: ["GE"] }), child, lab), false);
    assert.equal(programApplies(program({ actCodes: ["TDR"] }), child, lab), true);
    assert.equal(programApplies(program({ inventoryItemIds: ["coartem"] }), child, line("p", 900, "pharmacy", { inventoryItemId: "other" })), false);
    assert.equal(programApplies(program({ eligibility: "enrolment", maxAgeMonths: null }), adult, lab), false);
    assert.equal(programApplies(program({ eligibility: "enrolment", maxAgeMonths: null, enrolled: true }), adult, lab), true);
    assert.equal(programApplies(program(), child, line("s", 1000, "surgery")), false);
  });
  it("keeps the most generous programme, a partial one leaves the rest to the payer", () => {
    const r = computeInvoiceCoverage({
      lines: [line("c", 10000, "consultation")],
      patient: adult,
      programs: [program({ id: "a", code: "A", rate: 30, families: ["consultation"], maxAgeMonths: null }), program({ id: "b", code: "B", rate: 50, families: ["consultation"], maxAgeMonths: null })],
      coverage: terms({ defaultRate: 80 }),
    });
    assert.deepEqual([r.lines[0].exemptionProgramId, r.exemptionAmount, r.payerAmount], ["b", 5000, 4000]);
  });
});

describe("helpers", () => {
  it("capProportionally sums exactly to the cap and never raises a value", () => {
    const out = capProportionally([333, 333, 334], 500);
    assert.equal(out.reduce((s, v) => s + v, 0), 500);
    assert.ok(out.every((v, i) => v <= [333, 333, 334][i]));
    assert.deepEqual(capProportionally([100, 200], 1000), [100, 200]);
    assert.deepEqual(capProportionally([100, 200], 0), [0, 0]);
  });
  it("patientShare never goes negative and adds a charged-back rejection", () => {
    assert.equal(patientShare(1000, 900, 200, 0), 0);
    assert.equal(patientShare(1000, 800, 0, 300), 500);
  });
});
