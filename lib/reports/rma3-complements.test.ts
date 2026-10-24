import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildComplementTables, type CmpChronicEnrolment, type Rma3ComplementsInput } from "@/lib/reports/rma3-complements";
import { allocateIncome, buildIncomeTable, defaultRubric, parseIncomeRubric } from "@/lib/reports/rma3-income";
import { parseAdverseReaction, parseChronicVisit, parseCivilDeclaration, parseTbCaseComplements, parseTbScreening } from "@/lib/programs/input-complements";

const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const start = d("2026-10-01");
const end = d("2026-11-01");
const now = d("2026-10-24");
const adult = { birthDate: d("1980-05-01"), gender: "M" };
const child = { birthDate: d("2024-05-01"), gender: "F" };
const teen = { birthDate: d("2009-05-01"), gender: "F" };
const id = "3f6c1d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f";

const empty: Rma3ComplementsInput = { start, end, tbScreenings: [], tbCases: [], consultations: [], ironPrescriptions: [], chronicEnrolments: [], declarations: [], reactions: [] };
const rowOf = (input: Partial<Rma3ComplementsInput>, code: string) =>
  buildComplementTables({ ...empty, ...input })
    .flatMap((t) => t.rows)
    .find((r) => r.code === code)!;

describe("TB screening and complements", () => {
  it("counts each step of the screening in its month", () => {
    const s = (o: object) => ({ id: "x", patientId: "p", screenedAt: d("2026-10-02"), presumptive: false, sentToLabAt: null, testedAt: null, tptStartedAt: null, patient: adult, ...o });
    const input = {
      tbScreenings: [
        s({ patientId: "a", presumptive: true, sentToLabAt: d("2026-10-03"), testedAt: d("2026-10-05") }),
        s({ patientId: "b" }),
        // Screened in September, tested and put on TPT in October.
        s({ patientId: "c", screenedAt: d("2026-09-25"), presumptive: true, testedAt: d("2026-10-01"), tptStartedAt: d("2026-10-10") }),
      ],
    };
    assert.equal(rowOf(input, "IV.3-001").total, 2);
    assert.equal(rowOf(input, "IV.3-002").total, 1);
    assert.equal(rowOf(input, "IV.3-003").total, 1);
    assert.equal(rowOf(input, "IV.3-004").total, 2);
    assert.equal(rowOf(input, "IV.3-005").cells.age15Plus, 1);
  });
  it("counts TB-RR, second line, cotrimoxazole and health workers by age and form", () => {
    const c = (o: object) => ({ id: "c", notificationDate: d("2026-10-02"), classification: "pulmonary_bacteriologically_confirmed" as const, rifampicinResistant: false, cotrimoxazole: false, isHealthWorker: false, secondLineStartedAt: null, patient: adult, ...o });
    const input = {
      tbCases: [
        c({ id: "1", rifampicinResistant: true, secondLineStartedAt: d("2026-10-20"), cotrimoxazole: true }),
        c({ id: "2", isHealthWorker: true, classification: "extrapulmonary" as const }),
      ],
    };
    assert.equal(rowOf(input, "IV.3-010").total, 1);
    assert.equal(rowOf(input, "IV.3-023").total, 1);
    assert.equal(rowOf(input, "IV.3-014").total, 1);
    assert.equal(rowOf(input, "IV.3-015").cells.age15Plus_extrapulmonary, 1);
  });
});

describe("protocol, adolescents, iron", () => {
  it("counts consultations per the national protocol for children and adolescents with an STI", () => {
    const c = (patientId: string, patient: typeof adult, o: object = {}) => ({ patientId, at: d("2026-10-05"), followedNationalProtocol: true, stiDiagnosis: false, patient, ...o });
    const input = {
      consultations: [c("k", child), c("k2", child, { followedNationalProtocol: false }), c("t", teen, { stiDiagnosis: true }), c("a", adult, { stiDiagnosis: true })],
      ironPrescriptions: [
        { patientId: "t", at: d("2026-10-06"), patient: teen },
        { patientId: "a", at: d("2026-10-06"), patient: adult },
      ],
    };
    assert.equal(rowOf(input, "III.7-006").total, 1);
    assert.equal(rowOf(input, "III.8-002").cells.age15to19_F, 1);
    assert.equal(rowOf(input, "III.8-002").total, 1);
    assert.equal(rowOf(input, "III.8-003").total, 1);
  });
});

describe("chronic care", () => {
  const visit = (o: object = {}) => ({ visitDate: d("2026-10-10"), onTreatment: true, systolic: null, diastolic: null, hba1c: null, educationIndividual: false, educationGroup: false, ...o });
  const enrol = (o: Partial<CmpChronicEnrolment> & Pick<CmpChronicEnrolment, "id">): CmpChronicEnrolment => ({ condition: "diabetes", enrolledAt: d("2026-01-01"), exitedAt: null, patient: adult, visits: [], ...o });
  it("computes the diabetes active file, exits, education and HbA1c", () => {
    const input = {
      chronicEnrolments: [
        enrol({ id: "1", visits: [visit({ educationIndividual: true, hba1c: 8.2 }), visit({ educationGroup: true, hba1c: 6.5 })] }),
        enrol({ id: "2", exitedAt: d("2026-10-15") }),
      ],
    };
    assert.equal(rowOf(input, "IV.4.1-005").total, 1);
    assert.equal(rowOf(input, "IV.4.1-006").total, 1);
    assert.equal(rowOf(input, "IV.4.1-007").total, 1);
    assert.equal(rowOf(input, "IV.4.1-008").total, 1);
    assert.equal(rowOf(input, "IV.4.1-009").total, 1);
  });
  it("counts hypertensives on treatment and controlled at their last visit", () => {
    const input = {
      chronicEnrolments: [
        enrol({ id: "h1", condition: "hypertension", visits: [visit({ systolic: 160, diastolic: 95, visitDate: d("2026-10-02") }), visit({ systolic: 130, diastolic: 80, visitDate: d("2026-10-20") })] }),
        enrol({ id: "h2", condition: "hypertension", visits: [visit({ onTreatment: false, systolic: 150, diastolic: 92 })] }),
      ],
    };
    assert.equal(rowOf(input, "IV.4.4-003").total, 1);
    assert.equal(rowOf(input, "IV.4.4-004").total, 1);
  });
});

describe("civil registration and pharmacovigilance", () => {
  it("counts declarations and reactions, with the detail of each reaction", () => {
    const input = {
      declarations: [
        { type: "birth" as const, transmittedAt: d("2026-10-03") },
        { type: "death" as const, transmittedAt: d("2026-10-04") },
        { type: "birth" as const, transmittedAt: d("2026-09-30") },
      ],
      reactions: [
        { id: "r1", reportedAt: d("2026-10-05"), serious: true, investigatedAt: d("2026-10-07"), drugName: "Amoxicilline", lotNumber: "L1", expiryDate: d("2027-01-01") },
        { id: "r2", reportedAt: d("2026-10-06"), serious: false, investigatedAt: null, drugName: "Paracétamol", lotNumber: null, expiryDate: null },
      ],
    };
    assert.equal(rowOf(input, "V.2-001").total, 1);
    assert.equal(rowOf(input, "V.2-002").total, 1);
    assert.equal(rowOf(input, "V.8-001").total, 2);
    assert.equal(rowOf(input, "V.8-002").total, 1);
    assert.equal(rowOf(input, "V.8-003").total, 1);
    assert.match(rowOf(input, "V.8-detail/1").label, /Amoxicilline · lot L1 · péremption 2027-01-01 · grave/);
  });
});

describe("billing income", () => {
  it("splits a payment over its invoice lines and the pharmacy into capital / profit", () => {
    const totals = allocateIncome([
      // Paid half of a 20 000 invoice: consultation 4 000, lab 6 000, drugs 10 000 (cost 6 000).
      {
        amount: 10_000,
        lines: [
          { amount: 4_000, rubric: "VI.3-003", purchaseCost: null },
          { amount: 6_000, rubric: "VI.3-009", purchaseCost: null },
          { amount: 10_000, rubric: "pharmacy", purchaseCost: 6_000 },
        ],
      },
      // Drugs without a known purchase cost: all profit.
      { amount: 1_000, lines: [{ amount: 1_000, rubric: "pharmacy", purchaseCost: null }] },
    ]);
    assert.deepEqual(totals, { "VI.3-003": 2000, "VI.3-009": 3000, "VI.3-019": 3000, "VI.3-020": 3000 });
  });
  it("maps billing sources to rubrics and builds the sub-totals with the monthly form", () => {
    assert.equal(defaultRubric("exam", "radiology"), "VI.3-011");
    assert.equal(defaultRubric("exam", "biology"), "VI.3-009");
    assert.equal(defaultRubric("other"), "unclassified");
    assert.equal(parseIncomeRubric("VI.3-012"), "VI.3-012");
    assert.equal(parseIncomeRubric("VI.3-019"), "invalid");
    const table = buildIncomeTable({ "VI.3-003": 2000, "VI.3-019": 500 }, { "VI.3-004": 100, "VI.3-022": 7000, "VI.3-027": 50, "VI.3-001": 999 });
    const total = (code: string) => table.rows.find((r) => r.code === code)!.total;
    assert.equal(total("VI.3-021"), 2600);
    assert.equal(total("VI.3-025"), 7000);
    assert.equal(total("VI.3-029"), 50);
  });
});

describe("validation", () => {
  it("validates TB screenings and case complements", () => {
    assert.equal(parseTbScreening({ patientId: id, screenedAt: "2026-10-15", presumptive: true, sentToLabAt: "2026-10-20" }, now).ok, true);
    assert.deepEqual(parseTbScreening({ patientId: id, screenedAt: "2026-10-15", sentToLabAt: "2026-10-20" }, now), { ok: false, error: "lab_needs_presumptive" });
    assert.deepEqual(parseTbScreening({ patientId: id, presumptive: true, testPositive: true }, now), { ok: false, error: "result_needs_test" });
    assert.deepEqual(parseTbCaseComplements({ rifampicinResistant: false, secondLineStartedAt: "2026-10-01" }, now), { ok: false, error: "second_line_needs_rr" });
  });
  it("validates chronic visits, civil declarations and reactions", () => {
    const enrolled = d("2026-01-01");
    assert.equal(parseChronicVisit({ systolic: 130, diastolic: 85, hba1c: 7.4 }, enrolled, now).ok, true);
    assert.deepEqual(parseChronicVisit({ systolic: 130 }, enrolled, now), { ok: false, error: "invalid_blood_pressure" });
    assert.deepEqual(parseChronicVisit({ hba1c: 40 }, enrolled, now), { ok: false, error: "invalid_hba1c" });
    assert.equal(parseCivilDeclaration({ type: "birth", personName: "Bébé A", eventDate: "2026-10-01", transmittedAt: "2026-10-10" }, now).ok, true);
    assert.deepEqual(parseCivilDeclaration({ type: "birth", personName: "Bébé A", eventDate: "2026-10-10", transmittedAt: "2026-10-01" }, now), { ok: false, error: "invalid_transmission_date" });
    assert.equal(parseAdverseReaction({ patientId: id, drugName: "Amoxicilline", description: "Éruption cutanée", serious: true }, now).ok, true);
    assert.deepEqual(parseAdverseReaction({ patientId: id, description: "Éruption" }, now), { ok: false, error: "invalid_drug" });
  });
});
