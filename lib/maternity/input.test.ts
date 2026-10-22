import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAntenatalExtras,
  parseDeliveryExtras,
  parseFpVisit,
  parseNewbornExtras,
  parseNewbornUpdate,
  parsePostnatalVisit,
  parsePregnancyOutcome,
} from "@/lib/maternity/input";
import { FP_METHODS } from "@/lib/family-planning/methods";

const now = new Date("2026-10-22T10:00:00Z");
const birth = new Date("2026-10-10T08:00:00Z");
const patientId = "3f6c1d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f";

describe("parseAntenatalExtras", () => {
  it("accepts outreach, a plausible haemoglobin and a Td dose of rank 1 to 5", () => {
    assert.deepEqual(parseAntenatalExtras({ strategy: "outreach", hemoglobinGPerDl: "10.46", td: { doseNumber: 3, lotNumber: " TD-22 " } }), {
      ok: true,
      value: { strategy: "outreach", hemoglobinGPerDl: 10.5, td: { doseNumber: 3, stockLotId: null, lotNumber: "TD-22" } },
    });
    assert.deepEqual(parseAntenatalExtras({}), { ok: true, value: { strategy: "fixed", hemoglobinGPerDl: null, td: null } });
  });
  it("refuses an unknown strategy, an implausible haemoglobin or a Td rank out of 1-5", () => {
    assert.equal(parseAntenatalExtras({ strategy: "mobile" }).ok, false);
    assert.equal(parseAntenatalExtras({ hemoglobinGPerDl: 40 }).ok, false);
    assert.equal(parseAntenatalExtras({ td: { doseNumber: 6 } }).ok, false);
    assert.equal(parseAntenatalExtras({ td: { doseNumber: 1, stockLotId: "x" } }).ok, false);
  });
});

describe("parseDeliveryExtras", () => {
  it("keeps the RMA3 complications and only counts management when there was one", () => {
    const parsed = parseDeliveryExtras({ complications: ["eclampsia", "uterine_rupture"], amtsl: true, complicationsManaged: true, breastfeedingStart: "within_30_min" });
    assert.deepEqual(parsed, { ok: true, value: { complications: ["eclampsia", "uterine_rupture"], amtsl: true, complicationsManaged: true, breastfeedingStart: "within_30_min" } });
    const none = parseDeliveryExtras({ complications: ["none"], complicationsManaged: true });
    assert.equal(none.ok && none.value.complicationsManaged, false);
  });
  it("refuses unknown complications, 'none' with another one, an unknown breastfeeding start", () => {
    assert.equal(parseDeliveryExtras({ complications: ["fracture"] }).ok, false);
    assert.equal(parseDeliveryExtras({ complications: ["none", "eclampsia"] }).ok, false);
    assert.equal(parseDeliveryExtras({ breastfeedingStart: "soon" }).ok, false);
  });
});

describe("parseNewbornExtras / parseNewbornUpdate", () => {
  it("requires the stillbirth type and a dated neonatal death within 28 days", () => {
    assert.equal(parseNewbornExtras({ outcome: "stillbirth" }, birth, now).ok, false);
    assert.equal(parseNewbornExtras({ outcome: "stillbirth", stillbirthType: "macerated" }, birth, now).ok, true);
    assert.equal(parseNewbornExtras({ outcome: "neonatal_death" }, birth, now).ok, false);
    assert.equal(parseNewbornExtras({ outcome: "neonatal_death", diedAt: "2026-10-09" }, birth, now).ok, false);
    const death = parseNewbornExtras({ outcome: "neonatal_death", diedAt: "2026-10-10", deathCause: "asphyxia" }, birth, now);
    assert.equal(death.ok && death.value.deathCause, "asphyxia");
    assert.equal(parseNewbornExtras({ outcome: "lost" }, birth, now).ok, false);
  });

  it("records a later death, refuses it for a stillbirth and checks the review date", () => {
    const update = parseNewbornUpdate({ died: true, diedAt: "2026-10-15", deathCause: "infection", deathReviewedAt: "2026-10-20", kangarooCare: true }, birth, { diedAt: null, outcome: "alive" }, now);
    assert.equal(update.ok, true);
    if (update.ok) {
      assert.equal(update.value.kangarooCare, true);
      assert.equal(update.value.death?.deathCause, "infection");
    }
    assert.equal(parseNewbornUpdate({ died: true, diedAt: "2026-10-15" }, birth, { diedAt: null, outcome: "stillbirth" }, now).ok, false);
    assert.equal(parseNewbornUpdate({ deathReviewedAt: "2026-10-20" }, birth, { diedAt: null, outcome: "alive" }, now).ok, false);
  });
});

describe("parsePregnancyOutcome", () => {
  const pregnancy = { lastMenstrualPeriod: new Date("2026-06-01"), status: "ongoing", hasDelivery: false };
  it("ends a pregnancy with post-abortion care and records a maternal death", () => {
    const parsed = parsePregnancyOutcome(
      { status: "miscarried", endedAt: "2026-10-05", abortionCare: "complicated", maternalDeath: { at: "2026-10-06", cause: "abortion", reviewedAt: "2026-10-15" } },
      pregnancy,
      now
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.abortionCare, "complicated");
      assert.equal(parsed.value.maternalDeath?.cause, "abortion");
    }
  });
  it("refuses 'delivered', an end before the LMP, a delivered pregnancy, an unknown cause", () => {
    assert.equal(parsePregnancyOutcome({ status: "delivered" }, pregnancy, now).ok, false);
    assert.equal(parsePregnancyOutcome({ status: "terminated", endedAt: "2026-05-01" }, pregnancy, now).ok, false);
    assert.equal(parsePregnancyOutcome({ status: "miscarried", endedAt: "2026-10-05" }, { ...pregnancy, hasDelivery: true }, now).ok, false);
    assert.equal(parsePregnancyOutcome({ maternalDeath: { at: "2026-10-06", cause: "unknown" } }, pregnancy, now).ok, false);
    assert.equal(parsePregnancyOutcome({ maternalDeath: { at: "2026-11-06", cause: "other" } }, pregnancy, now).ok, false);
  });
});

describe("parsePostnatalVisit", () => {
  it("accepts a visit between the delivery and 90 days after it", () => {
    assert.equal(parsePostnatalVisit({ visitDate: "2026-10-12", vitaminAGiven: true }, birth, now).ok, true);
    assert.equal(parsePostnatalVisit({ visitDate: "2026-10-08" }, birth, now).ok, false);
    assert.equal(parsePostnatalVisit({ visitDate: "2026-10-30" }, birth, now).ok, false); // future
  });
});

describe("parseFpVisit", () => {
  const base = { patientId, clientStatus: "new_user", counseled: true };
  it("accepts a method compatible with the patient's sex and a coherent procedure", () => {
    assert.equal(parseFpVisit({ ...base, methodCode: "implant", procedure: "implant_insertion", nextDueDate: "2029-10-22" }, "F", now).ok, true);
    assert.equal(parseFpVisit({ ...base, methodCode: "vasectomy" }, "M", now).ok, true);
    assert.equal(parseFpVisit({ ...base, methodCode: null, procedure: "iud_removal" }, "F", now).ok, true);
  });
  it("refuses unknown methods, the other sex's methods, inconsistent procedures and post-partum", () => {
    assert.deepEqual(parseFpVisit({ ...base, methodCode: "patch" }, "F", now), { ok: false, error: "invalid_method" });
    assert.deepEqual(parseFpVisit({ ...base, methodCode: "iud" }, "M", now), { ok: false, error: "method_sex_mismatch" });
    assert.deepEqual(parseFpVisit({ ...base, methodCode: "vasectomy" }, "F", now), { ok: false, error: "method_sex_mismatch" });
    assert.deepEqual(parseFpVisit({ ...base, methodCode: "coc", procedure: "implant_insertion" }, "F", now), { ok: false, error: "procedure_method_mismatch" });
    assert.deepEqual(parseFpVisit({ ...base, methodCode: "coc", isPostpartum: true }, "F", now), { ok: false, error: "method_not_postpartum" });
    assert.deepEqual(parseFpVisit({ ...base, isPostpartum: true }, "M", now), { ok: false, error: "invalid_postpartum" });
    assert.deepEqual(parseFpVisit({ ...base, clientStatus: "old" }, "F", now), { ok: false, error: "invalid_client_status" });
    assert.deepEqual(parseFpVisit({ ...base, nextDueDate: "2026-01-01" }, "F", now), { ok: false, error: "invalid_next_due_date" });
    assert.deepEqual(parseFpVisit({ ...base, patientId: "x" }, "F", now), { ok: false, error: "invalid_patient" });
  });
  it("has 17 methods, 7 of them post-partum, with unique codes", () => {
    assert.equal(FP_METHODS.length, 17);
    assert.equal(FP_METHODS.filter((m) => m.postpartum).length, 7);
    assert.equal(new Set(FP_METHODS.map((m) => m.code)).size, 17);
  });
});
