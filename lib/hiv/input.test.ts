import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSuppressed, parseArtVisit, parseEnrolment, parseHepatitisCase, parseScreeningTest, parseStatusChange, parseViralLoad } from "@/lib/hiv/input";

const now = new Date("2026-10-25T10:00:00Z");
const ID = "3f2c1a9e-5b6d-4c7e-8f90-1a2b3c4d5e6f";

describe("parseScreeningTest", () => {
  const base = { patientId: ID, testType: "hiv", result: "negative", entryPoint: "antenatal", testedAt: "2026-10-20" };

  it("accepts a test and only keeps a treatment date on a positive result", () => {
    const r = parseScreeningTest({ ...base, treatedAt: "2026-10-21" }, now);
    assert.ok(r.ok);
    assert.equal(r.value.treatedAt, null);
    const pos = parseScreeningTest({ ...base, testType: "syphilis", result: "positive", treatedAt: "2026-10-21" }, now);
    assert.ok(pos.ok);
    assert.ok(pos.value.treatedAt);
  });

  it("rejects unknown values, future dates and a test both of and for a partner", () => {
    assert.deepEqual(parseScreeningTest({ ...base, testType: "malaria" }, now), { ok: false, error: "invalid_test_type" });
    assert.deepEqual(parseScreeningTest({ ...base, testedAt: "2026-11-01" }, now), { ok: false, error: "future_date" });
    assert.deepEqual(parseScreeningTest({ ...base, pregnancyId: ID, partnerOfPregnancyId: ID }, now), { ok: false, error: "invalid_pregnancy" });
    assert.deepEqual(parseScreeningTest({ ...base, resultCollectedAt: "2026-10-01" }, now), { ok: false, error: "date_order" });
  });
});

describe("parseEnrolment and parseStatusChange", () => {
  it("allows an earlier ART start only for a transfer in", () => {
    const base = { patientId: ID, entryPoint: "vct", artStartDate: "2024-01-01", enrolledAt: "2026-10-01" };
    assert.deepEqual(parseEnrolment(base, now), { ok: false, error: "date_order" });
    assert.ok(parseEnrolment({ ...base, transferIn: "in_country" }, now).ok);
  });

  it("requires the scope of a transfer out", () => {
    assert.deepEqual(parseStatusChange({ status: "transferred_out", statusChangedAt: "2026-10-01" }, now), { ok: false, error: "invalid_transfer" });
    assert.ok(parseStatusChange({ status: "dead", statusChangedAt: "2026-10-01" }, now).ok);
  });
});

describe("parseArtVisit", () => {
  it("takes the line from the regimen and the next appointment from the days dispensed", () => {
    const r = parseArtVisit({ visitDate: "2026-10-20", regimenCode: "AZT-3TC-ATVr", daysDispensed: 90 }, now);
    assert.ok(r.ok);
    assert.equal(r.value.regimenLine, 2);
    assert.equal(r.value.nextAppointmentDate.toISOString().slice(0, 10), "2027-01-18");
  });

  it("makes the TB answers consistent", () => {
    const r = parseArtVisit({ visitDate: "2026-10-20", regimenCode: "TDF-3TC-DTG", daysDispensed: 30, tbTreatmentStarted: true }, now);
    assert.ok(r.ok);
    assert.deepEqual([r.value.tbScreened, r.value.tbConfirmed, r.value.tbTreatmentStarted], [true, true, true]);
    assert.deepEqual(parseArtVisit({ regimenCode: "XYZ", daysDispensed: 30 }, now), { ok: false, error: "invalid_regimen" });
  });
});

describe("viral load and hepatitis", () => {
  it("uses the WHO threshold for HIV, undetectable for hepatitis", () => {
    assert.equal(isSuppressed("hiv", 800, false), true);
    assert.equal(isSuppressed("hiv", 1200, false), false);
    assert.equal(isSuppressed("hbv", 15, false), false);
    assert.equal(isSuppressed("hbv", null, true), true);
    assert.deepEqual(parseViralLoad({ patientId: ID, program: "hiv", sampledAt: "2026-10-01" }, now), { ok: false, error: "invalid_value" });
  });

  it("keeps cure for hepatitis C and dates after the diagnosis", () => {
    assert.deepEqual(parseHepatitisCase({ patientId: ID, type: "hbv", diagnosedAt: "2026-01-01", curedAt: "2026-05-01" }, now), { ok: false, error: "invalid_type" });
    assert.deepEqual(parseHepatitisCase({ patientId: ID, type: "hcv", diagnosedAt: "2026-05-01", treatmentStartedAt: "2026-04-01" }, now), { ok: false, error: "date_order" });
    assert.ok(parseHepatitisCase({ patientId: ID, type: "hcv", diagnosedAt: "2026-05-01", curedAt: "2026-09-01" }, now).ok);
  });
});
