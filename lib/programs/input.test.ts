import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseEquipment,
  parseGrowthVisit,
  parseHypoxemiaEpisode,
  parseHypoxemiaOutcome,
  parseMalariaComplements,
  parseNutritionAdmission,
  parseNutritionUpdate,
} from "@/lib/programs/input";
import { parseBagUpdate, parseDonation, parseDonor } from "@/lib/blood-bank/input";
import { parseStaffMember } from "@/lib/hr/input";
import { STAFF_CADRES } from "@/lib/hr/cadres";

const now = new Date("2026-10-24T10:00:00Z");
const id = "3f6c1d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f";

describe("malaria complements", () => {
  it("accepts a species for a positive test only, and the listed molecules", () => {
    assert.equal(parseMalariaComplements({ species: "vivax", treatment: "al", hospitalized: true }, "positive").ok, true);
    assert.deepEqual(parseMalariaComplements({ species: "vivax" }, "negative"), { ok: false, error: "species_needs_positive" });
    assert.deepEqual(parseMalariaComplements({ treatment: "chloroquine" }, "positive"), { ok: false, error: "invalid_treatment" });
  });
});

describe("oxygen", () => {
  it("validates equipment fields", () => {
    assert.equal(parseEquipment({ code: "ox-01", type: "pulse_oximeter", label: "Oxymètre 1" }, { partial: false }).ok, true);
    assert.equal(parseEquipment({ code: "ox 01", type: "pulse_oximeter", label: "x" }, { partial: false }).ok, false);
    assert.deepEqual(parseEquipment({ status: "lost" }, { partial: true }), { ok: false, error: "invalid_status" });
  });
  it("needs a hypoxaemia (SpO2 < 90) or a respiratory distress", () => {
    assert.equal(parseHypoxemiaEpisode({ patientId: id, spo2: 85 }, now).ok, true);
    assert.equal(parseHypoxemiaEpisode({ patientId: id, spo2: 95, respiratoryDistress: true }, now).ok, true);
    assert.deepEqual(parseHypoxemiaEpisode({ patientId: id, spo2: 95 }, now), { ok: false, error: "not_hypoxemia" });
    assert.deepEqual(parseHypoxemiaEpisode({ patientId: id, spo2: 120 }, now), { ok: false, error: "invalid_spo2" });
  });
  it("dates an outcome after the detection", () => {
    const detected = new Date("2026-10-20T10:00:00Z");
    assert.equal(parseHypoxemiaOutcome({ outcome: "cured", outcomeAt: "2026-10-22" }, detected, now).ok, true);
    assert.deepEqual(parseHypoxemiaOutcome({ outcome: "cured", outcomeAt: "2026-10-19" }, detected, now), { ok: false, error: "invalid_outcome_date" });
  });
});

describe("nutrition", () => {
  it("validates admissions and exits", () => {
    assert.equal(parseNutritionAdmission({ patientId: id, program: "cna", admissionType: "new_case", criterion: "muac", muacMm: 110 }, now).ok, true);
    assert.deepEqual(parseNutritionAdmission({ patientId: id, program: "cnas", admissionType: "new_case" }, now), { ok: false, error: "invalid_program" });
    assert.deepEqual(parseNutritionAdmission({ patientId: id, program: "cna", admissionType: "new_case", muacMm: 20 }, now), { ok: false, error: "invalid_muac" });
    const admitted = new Date("2026-10-01");
    assert.equal(parseNutritionUpdate({ exitReason: "cured", exitedAt: "2026-10-20" }, admitted, now).ok, true);
    assert.deepEqual(parseNutritionUpdate({ exitReason: "cured", exitedAt: "2026-09-20" }, admitted, now), { ok: false, error: "invalid_exit_date" });
  });
  it("validates growth visits", () => {
    assert.equal(parseGrowthVisit({ patientId: id, weightKg: 8.5, receivesWater: false }, now).ok, true);
    assert.deepEqual(parseGrowthVisit({ patientId: id, weightKg: 200 }, now), { ok: false, error: "invalid_weight" });
  });
});

describe("blood bank", () => {
  it("validates donors and donations", () => {
    assert.equal(parseDonor({ code: "d-1", fullName: "A B", sex: "M", donorType: "voluntary", bloodGroup: "O+" }, now).ok, true);
    assert.deepEqual(parseDonor({ code: "d-1", fullName: "A B", sex: "M", donorType: "paid" }, now), { ok: false, error: "invalid_donor_type" });
    assert.equal(parseDonation({ donorId: id, bagNumber: "P-001", hivResult: "negative" }, now).ok, true);
    assert.deepEqual(parseDonation({ donorId: id, bagNumber: "P-001", hivResult: "maybe" }, now), { ok: false, error: "invalid_hivResult" });
  });
  it("only releases a bag negative for the four markers, and follows the bag's life", () => {
    const bag = { status: "quarantine", collectedAt: new Date("2026-10-20"), hivResult: "negative", hbvResult: "negative", hcvResult: "negative", syphilisResult: "not_done" };
    assert.deepEqual(parseBagUpdate({ action: "release" }, bag, now), { ok: false, error: "bag_not_safe" });
    assert.equal(parseBagUpdate({ action: "release" }, { ...bag, syphilisResult: "negative" }, now).ok, true);
    assert.deepEqual(parseBagUpdate({ action: "release" }, { ...bag, syphilisResult: "positive" }, now), { ok: false, error: "bag_not_safe" });
    assert.deepEqual(parseBagUpdate({ action: "serve" }, bag, now), { ok: false, error: "bag_not_available" });
    assert.equal(parseBagUpdate({ action: "transfuse", recipientPatientId: id }, { ...bag, status: "served" }, now).ok, true);
    assert.deepEqual(parseBagUpdate({ action: "destroy", reason: "x" }, bag, now), { ok: false, error: "invalid_reason" });
    assert.deepEqual(parseBagUpdate({ action: "destroy", reason: "Périmée" }, { ...bag, status: "transfused" }, now), { ok: false, error: "bag_already_used" });
  });
});

describe("staff register", () => {
  it("has the 35 RMA3 cadres", () => {
    assert.equal(STAFF_CADRES.length, 35);
    assert.equal(STAFF_CADRES[34].rma3Code, "VI.5-035");
  });
  it("validates a staff member, fully on creation and partly on update", () => {
    assert.equal(parseStaffMember({ fullName: "Awa N.", sex: "F", cadre: "VI5_002", payer: "state", retirementDate: "2031-06-30" }, { partial: false }).ok, true);
    assert.deepEqual(parseStaffMember({ fullName: "Awa N.", sex: "F", cadre: "VI5_099", payer: "state" }, { partial: false }), { ok: false, error: "invalid_cadre" });
    assert.deepEqual(parseStaffMember({ fullName: "Awa", sex: "F", cadre: "VI5_002", payer: "state", birthDate: "1980-01-01", retirementDate: "1979-01-01" }, { partial: false }), {
      ok: false,
      error: "invalid_retirementDate",
    });
    assert.deepEqual(parseStaffMember({ inPost: false }, { partial: true }), { ok: true, value: { inPost: false } });
  });
});
