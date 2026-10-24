import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProgramTables,
  type ProgramDonation,
  type ProgramEpisode,
  type ProgramMalariaCase,
  type ProgramNutritionCase,
  type Rma3ProgramsInput,
} from "@/lib/reports/rma3-programs";

const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const start = d("2026-10-01");
const end = d("2026-11-01");
const child = { birthDate: d("2024-05-01"), gender: "M" };
const adult = { birthDate: d("1990-05-01"), gender: "F" };

const empty: Rma3ProgramsInput = {
  start,
  end,
  malariaCases: [],
  itnVisits: [],
  equipment: [],
  episodes: [],
  nutritionCases: [],
  growthVisits: [],
  donations: [],
  mobileSessions: [],
  donorsStartedOnArt: 0,
  staff: [],
};
const rowOf = (input: Partial<Rma3ProgramsInput>, code: string) =>
  buildProgramTables({ ...empty, ...input })
    .flatMap((t) => t.rows)
    .find((r) => r.code === code)!;

describe("malaria complements", () => {
  const malaria = (o: Partial<ProgramMalariaCase> & Pick<ProgramMalariaCase, "id">): ProgramMalariaCase => ({
    diagnosedAt: d("2026-10-05"),
    testType: "rdt",
    result: "positive",
    severity: "simple",
    species: "falciparum",
    treatment: "asaq",
    treatedWithAct: true,
    hospitalized: false,
    freeOfCharge: false,
    isPregnantAtDiagnosis: false,
    patient: child,
    ...o,
  });
  const input = {
    malariaCases: [
      malaria({ id: "1", freeOfCharge: true }),
      malaria({ id: "2", species: "mixed", treatment: "al" }),
      malaria({ id: "3", testType: "microscopy", species: "vivax", treatment: "dhap" }),
      malaria({ id: "4", severity: "severe", treatment: "artesunate_inj", hospitalized: true, patient: adult, isPregnantAtDiagnosis: true }),
      // Severe suspicion, negative test, hospitalised and given quinine anyway.
      malaria({ id: "5", severity: "severe", result: "negative", species: null, treatment: "quinine_inj", hospitalized: true }),
      // Clinical only, given an ACT.
      malaria({ id: "6", testType: "clinical_only", result: "pending", species: null, treatment: null, treatedWithAct: true }),
    ],
    itnVisits: [{ patientId: "w", visitDate: d("2026-10-03") }],
  };
  it("splits by species and test", () => {
    assert.equal(rowOf(input, "IV.2.4-5-026").total, 2); // cases 1 and 4 (severe, falciparum)
    assert.equal(rowOf(input, "IV.2.4-5-027").total, 1);
    assert.equal(rowOf(input, "IV.2.4-5-031").total, 1);
    assert.equal(rowOf(input, "IV.2.4-5-028").total, 0);
  });
  it("counts the molecules, hospitalisations and free treatments", () => {
    assert.equal(rowOf(input, "IV.2.4-5-039").total, 1);
    assert.equal(rowOf(input, "IV.2.4-5-040").total, 1);
    assert.equal(rowOf(input, "IV.2.4-5-041").total, 1);
    assert.equal(rowOf(input, "IV.2.4-5-044").total, 1);
    assert.equal(rowOf(input, "IV.2.4-5-008").total, 1);
    assert.equal(rowOf(input, "IV.2.4-5-007").cells.pregnant, 1);
    assert.equal(rowOf(input, "IV.2.4-5-022").total, 2);
    assert.equal(rowOf(input, "IV.2.4-5-009").total, 1);
  });
  it("counts antimalarials given without a positive test", () => {
    assert.equal(rowOf(input, "IV.2.4-5-047").total, 1);
    assert.equal(rowOf(input, "IV.2.4-5-048").total, 1);
    assert.equal(rowOf(input, "IV.2.2-3-001").total, 1);
  });
});

describe("oxygen", () => {
  const episode = (o: Partial<ProgramEpisode> & Pick<ProgramEpisode, "id">): ProgramEpisode => ({
    patientId: o.id,
    detectedAt: d("2026-10-10"),
    spo2: 85,
    respiratoryDistress: false,
    deliveryRoom: false,
    oxygenGiven: true,
    outcome: null,
    outcomeAt: null,
    patient: adult,
    pregnancies: [],
    ...o,
  });
  const input: Partial<Rma3ProgramsInput> = {
    equipment: [
      { type: "pulse_oximeter", status: "functional" },
      { type: "pulse_oximeter", status: "broken" },
      { type: "pulse_oximeter", status: "retired" },
      { type: "oxygen_concentrator", status: "functional" },
    ],
    episodes: [
      episode({ id: "nb", patient: { birthDate: d("2026-10-05"), gender: "M" }, outcome: "died", outcomeAt: d("2026-10-12") }),
      episode({ id: "ch", patient: child, spo2: 93, respiratoryDistress: true, outcome: "cured", outcomeAt: d("2026-10-14") }),
      episode({ id: "pp", pregnancies: [{ lastMenstrualPeriod: d("2026-01-01"), endedAt: d("2026-10-01") }], oxygenGiven: false }),
    ],
  };
  it("counts the park and its functional part", () => {
    assert.equal(rowOf(input, "V.9-006").total, 2);
    assert.equal(rowOf(input, "V.9-007").total, 1);
    assert.equal(rowOf(input, "V.9-008").total, 1);
  });
  it("classifies the episodes by patient group and outcome", () => {
    assert.equal(rowOf(input, "V.9-013").total, 2); // the child has SpO2 93 (distress only)
    assert.equal(rowOf(input, "V.9-014").total, 1);
    assert.equal(rowOf(input, "V.9-015").total, 1);
    assert.equal(rowOf(input, "V.9-018").total, 1);
    assert.equal(rowOf(input, "V.9-019").total, 1);
    assert.equal(rowOf(input, "V.9-023").total, 0);
    assert.equal(rowOf(input, "V.9-026").total, 1);
    assert.equal(rowOf(input, "V.9-028").total, 1);
  });
});

describe("PCIMA", () => {
  const kid = { birthDate: d("2025-01-01"), gender: "F" };
  const nutrition = (o: Partial<ProgramNutritionCase> & Pick<ProgramNutritionCase, "id">): ProgramNutritionCase => ({
    program: "cna",
    admittedAt: d("2026-10-05"),
    admissionType: "new_case",
    residency: "resident",
    hivTested: false,
    anjeCounseling: false,
    exitedAt: null,
    exitReason: null,
    patient: kid,
    ...o,
  });
  const input = {
    nutritionCases: [
      nutrition({ id: "old", admittedAt: d("2026-09-10") }),
      nutrition({ id: "cured", admittedAt: d("2026-09-01"), exitedAt: d("2026-10-20"), exitReason: "cured" }),
      nutrition({ id: "new", residency: "refugee", hivTested: true }),
      nutrition({ id: "re", admissionType: "readmission_after_default" }),
      nutrition({ id: "in", admissionType: "transfer_in", exitedAt: d("2026-10-25"), exitReason: "transfer_out" }),
      nutrition({ id: "ti", program: "cnti", admissionType: "new_case" }),
    ],
  };
  const cna = (code: string) => buildProgramTables({ ...empty, ...input }).find((t) => t.title.includes("CNA"))!.rows.find((r) => r.code === code)!;
  it("keeps the monthly balance: start + admissions - exits = end", () => {
    assert.equal(cna("IV.6-001").total, 2);
    assert.equal(cna("IV.6-002").total, 1);
    assert.equal(cna("IV.6-003").total, 1);
    assert.equal(cna("IV.6-005").total, 2);
    assert.equal(cna("IV.6-006").total, 3);
    assert.equal(cna("IV.6-007").total, 1);
    assert.equal(cna("IV.6-013").total, 2);
    assert.equal(cna("IV.6-014").total, cna("IV.6-001").total + cna("IV.6-006").total - cna("IV.6-013").total);
  });
  it("breaks down by age band at admission, and counts statuses and HIV tests", () => {
    assert.equal(cna("IV.6-002").cells.age6to59m, 1);
    assert.equal(cna("IV.6-015/refugee").total, 1);
    assert.equal(cna("IV.6-016").total, 1);
  });
});

describe("infant feeding", () => {
  it("counts children by age-specific practice, once each", () => {
    const baby = { birthDate: d("2026-07-01"), gender: "F" };
    const toddler = { birthDate: d("2024-07-01"), gender: "M" };
    const visit = (patientId: string, patient: typeof baby, o: object) => ({
      patientId,
      visitDate: d("2026-10-10"),
      weightKg: 6,
      receivesWater: null,
      complementaryFood: null,
      stillBreastfed: null,
      multivitaminGiven: false,
      patient,
      ...o,
    });
    const input = {
      growthVisits: [
        visit("b", baby, { receivesWater: true }),
        visit("b", baby, { receivesWater: true, complementaryFood: true }),
        visit("t", toddler, { stillBreastfed: true, multivitaminGiven: true }),
      ],
    };
    assert.equal(rowOf(input, "III.9-002").total, 1);
    assert.equal(rowOf(input, "III.9-003").total, 1);
    assert.equal(rowOf(input, "III.9-004").total, 2);
    assert.equal(rowOf(input, "III.9-006").total, 1);
    assert.equal(rowOf(input, "III.9-007").total, 1);
  });
});

describe("blood bank", () => {
  const donation = (o: Partial<ProgramDonation> & Pick<ProgramDonation, "id" | "donorId">): ProgramDonation => ({
    donorType: "voluntary",
    previousDonations: 0,
    sessionId: null,
    collectedAt: d("2026-10-05"),
    hivResult: "negative",
    hbvResult: "negative",
    hcvResult: "negative",
    syphilisResult: "negative",
    servedAt: null,
    transfusedAt: null,
    destroyedAt: null,
    ...o,
  });
  const input = {
    donations: [
      donation({ id: "1", donorId: "a", previousDonations: 2, transfusedAt: d("2026-10-08") }),
      donation({ id: "2", donorId: "b", donorType: "family", sessionId: "s", hivResult: "positive", hbvResult: "positive", destroyedAt: d("2026-10-09") }),
      donation({ id: "3", donorId: "c", syphilisResult: "not_done" }),
      // Collected in September, served in October.
      donation({ id: "4", donorId: "d", collectedAt: d("2026-09-28"), servedAt: d("2026-10-02") }),
    ],
    mobileSessions: [{ id: "s", heldAt: d("2026-10-05") }],
    donorsStartedOnArt: 1,
  };
  it("counts bags by event month", () => {
    assert.equal(rowOf(input, "V.6-001").total, 3);
    assert.equal(rowOf(input, "V.6-026").total, 1);
    assert.equal(rowOf(input, "V.6-003").total, 2);
    assert.equal(rowOf(input, "V.6-004").total, 1);
    assert.equal(rowOf(input, "V.6-002").total, 1);
    assert.equal(rowOf(input, "V.6-010").total, 1);
    assert.equal(rowOf(input, "V.6-024").total, 1);
  });
  it("counts donors by type and screening result", () => {
    assert.equal(rowOf(input, "V.6-006").total, 2);
    assert.equal(rowOf(input, "V.6-008").total, 1);
    assert.equal(rowOf(input, "V.6-009").total, 1);
    assert.equal(rowOf(input, "V.6-015").total, 2);
    assert.equal(rowOf(input, "V.6-020").total, 1);
    assert.equal(rowOf(input, "V.6-023").total, 1);
  });
});

describe("staff register", () => {
  it("counts present staff by sex, payer and post; retirements of this year and next", () => {
    const staff = [
      { cadre: "VI5_001", sex: "M", payer: "state" as const, inPost: true, hiredAt: null, retirementDate: d("2027-03-01"), leftAt: null },
      { cadre: "VI5_001", sex: "F", payer: "local" as const, inPost: false, hiredAt: null, retirementDate: null, leftAt: null },
      // Retired in March: in "retirés dans l'année", not in the headcount.
      { cadre: "VI5_001", sex: "F", payer: "state" as const, inPost: true, hiredAt: null, retirementDate: d("2026-03-01"), leftAt: null },
      // Left before the end of the month: not counted.
      { cadre: "VI5_001", sex: "M", payer: "state" as const, inPost: true, hiredAt: null, retirementDate: null, leftAt: d("2026-10-15") },
    ];
    const doctors = rowOf({ staff }, "VI.5-001");
    assert.equal(doctors.total, 2);
    assert.equal(doctors.cells.total_M, 1);
    assert.equal(doctors.cells.state_M, 1);
    assert.equal(doctors.cells.local_F, 1);
    assert.equal(doctors.cells.inPost_F, 0);
    assert.equal(doctors.cells.retireNext_M, 1);
    assert.equal(doctors.cells.retiredYear_F, 1);
  });
});
