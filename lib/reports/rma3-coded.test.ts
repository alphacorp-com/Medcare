import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCodedTables, type CodedDiagnosis, type Rma3CodedInput } from "@/lib/reports/rma3-coded";
import { buildMorbidityTables, type MorbidityDiagnosis } from "@/lib/reports/rma3-morbidity";
import { DEFAULT_MORBIDITY_RUBRICS } from "@/lib/reports/rma3-morbidity-default";
import { parseRma3ActIndicator } from "@/lib/reports/rma3-acts";

const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const start = d("2026-10-01");
const end = d("2026-11-01");
const woman40 = { birthDate: d("1986-05-01"), gender: "F" };
const man60 = { birthDate: d("1966-05-01"), gender: "M" };
const child2 = { birthDate: d("2024-05-01"), gender: "M" };
const teen17 = { birthDate: d("2009-05-01"), gender: "F" };

const empty: Rma3CodedInput = { start, end, diagnoses: [], stayTreatments: {}, positiveMalariaTests: [], acts: [] };
const dx = (o: Partial<CodedDiagnosis> & Pick<CodedDiagnosis, "patientId" | "icd10Code">): CodedDiagnosis => ({
  stayId: `stay-${o.patientId}`,
  context: "consultation",
  isNewCase: true,
  isSuspected: false,
  recordedAt: d("2026-10-10"),
  stayTransferred: false,
  patient: woman40,
  pregnancies: [],
  ...o,
});
const rowOf = (input: Partial<Rma3CodedInput>, code: string) =>
  buildCodedTables({ ...empty, ...input })
    .flatMap((t) => t.rows)
    .find((r) => r.code === code)!;

describe("cancers: suspected, managed, referred", () => {
  const input = {
    diagnoses: [
      dx({ patientId: "a", icd10Code: "C50.9", isSuspected: true }),
      dx({ patientId: "b", icd10Code: "C50" }),
      dx({ patientId: "c", icd10Code: "C50", stayTransferred: true }),
      dx({ patientId: "e", icd10Code: "C53", isSuspected: true, stayTransferred: true }),
      dx({ patientId: "f", icd10Code: "C61", patient: man60 }),
    ],
    acts: [
      { id: "x1", patientId: "w1", at: d("2026-10-03"), indicator: "II.2-001", patient: woman40 },
      // Outside 30-49: not counted.
      { id: "x2", patientId: "w2", at: d("2026-10-03"), indicator: "II.2-001", patient: teen17 },
    ],
  };
  it("splits by the suspected flag and the referral of the stay", () => {
    assert.equal(rowOf(input, "II.2-002").total, 1);
    assert.equal(rowOf(input, "II.2-004").total, 1);
    assert.equal(rowOf(input, "II.2-005").total, 1);
    assert.equal(rowOf(input, "II.2-006").total, 1);
    assert.equal(rowOf(input, "II.2-009").total, 1); // suspected and referred
    assert.equal(rowOf(input, "II.2-008").total, 0);
    assert.equal(rowOf(input, "II.2-014").total, 1);
  });
  it("counts cervical screening acts of women aged 30-49 only", () => {
    assert.equal(rowOf(input, "II.2-001").total, 1);
  });
});

describe("PCIMNE treatments", () => {
  it("needs the diagnosis and the tagged treatment in the same stay, under 5 years", () => {
    const input: Partial<Rma3CodedInput> = {
      diagnoses: [
        dx({ patientId: "k1", icd10Code: "A09", patient: child2 }),
        dx({ patientId: "k2", icd10Code: "A09", patient: child2 }),
        dx({ patientId: "k3", icd10Code: "J18", patient: child2 }),
        // An adult with diarrhoea and ORS: not a child.
        dx({ patientId: "ad", icd10Code: "A09", patient: man60 }),
      ],
      stayTreatments: { "stay-k1": ["ors", "zinc"], "stay-k2": ["ors"], "stay-k3": ["antibiotic"], "stay-ad": ["ors"] },
    };
    assert.equal(rowOf(input, "III.7-002").total, 2);
    assert.equal(rowOf(input, "III.7-003").total, 1);
    assert.equal(rowOf(input, "III.7-005").total, 1);
  });
});

describe("other crossings", () => {
  it("counts adolescents with an STI, sick newborns, road accidents and mental health referrals", () => {
    const newborn = { birthDate: d("2026-10-01"), gender: "F" };
    const input = {
      diagnoses: [
        dx({ patientId: "t", icd10Code: "A54", patient: teen17 }),
        dx({ patientId: "o", icd10Code: "A54", patient: man60 }),
        dx({ patientId: "n1", icd10Code: "P59", patient: newborn }),
        // A routine newborn check (chapter Z) is not a sick newborn.
        dx({ patientId: "n2", icd10Code: "Z00", patient: newborn }),
        dx({ patientId: "r", icd10Code: "V89", patient: man60 }),
        dx({ patientId: "r2", icd10Code: "V89", patient: man60, context: "death" }),
        dx({ patientId: "m", icd10Code: "F20", patient: man60, stayTransferred: true }),
      ],
    };
    assert.deepEqual(rowOf(input, "III.8-001").cells, { age10to14_M: 0, age10to14_F: 0, age15to19_M: 0, age15to19_F: 1, age20to24_M: 0, age20to24_F: 0 });
    assert.equal(rowOf(input, "III.8-001").total, 1);
    assert.deepEqual(rowOf(input, "II.1.4-012").cells, { M: 0, F: 1 });
    assert.equal(rowOf(input, "V.1-005").total, 1);
    assert.equal(rowOf(input, "V.1-009").total, 1);
    assert.equal(rowOf(input, "IV.4.9-013").total, 1);
  });

  it("counts confirmed malaria deaths: species coded, or unspecified with a recent positive test", () => {
    const input = {
      diagnoses: [
        dx({ patientId: "p1", icd10Code: "B50", context: "death", patient: child2 }),
        dx({ patientId: "p2", icd10Code: "B54", context: "death", recordedAt: d("2026-10-20") }),
        dx({ patientId: "p3", icd10Code: "B54", context: "death", recordedAt: d("2026-10-20") }),
      ],
      positiveMalariaTests: [
        { patientId: "p2", at: d("2026-10-05") },
        // Too old (more than 30 days before the death).
        { patientId: "p3", at: d("2026-09-01") },
      ],
    };
    assert.equal(rowOf(input, "IV.2.4-5-020").total, 2);
    assert.equal(rowOf(input, "IV.2.4-5-020").cells.under5_M, 1);
  });

  it("counts the acts of each indicator by age band and sex", () => {
    const input = {
      acts: [
        { id: "1", patientId: "a", at: d("2026-10-02"), indicator: "IV.4.11-011", patient: man60 },
        { id: "2", patientId: "a", at: d("2026-10-09"), indicator: "IV.4.11-011", patient: man60 },
        { id: "3", patientId: "b", at: d("2026-10-02"), indicator: "IV.4.10-003", patient: woman40 },
      ],
    };
    assert.equal(rowOf(input, "IV.4.11-011").cells.age50plus_M, 2);
    assert.equal(rowOf(input, "IV.4.10-003").cells.age15to49, 1);
  });
});

describe("morbidity complements", () => {
  const rubrics = DEFAULT_MORBIDITY_RUBRICS;
  const diag = (o: Partial<MorbidityDiagnosis> & Pick<MorbidityDiagnosis, "icd10Code">): MorbidityDiagnosis => ({
    context: "consultation",
    isNewCase: true,
    isSuspected: false,
    recordedAt: d("2026-10-10"),
    patient: { birthDate: d("1966-05-01"), gender: "M" },
    ...o,
  });
  const table = (diagnoses: MorbidityDiagnosis[], section: string) => buildMorbidityTables(rubrics, diagnoses).find((t) => t.section === section)!;

  it("keeps suspected diagnoses out of the new cases", () => {
    const t = table([diag({ icd10Code: "C50", isSuspected: true }), diag({ icd10Code: "C50" })], "II.2");
    assert.equal(t.rows[0].total, 1);
  });

  it("splits diabetes type 1 / 2 and breaks the deaths down by age and sex", () => {
    const t = table([diag({ icd10Code: "E11" }), diag({ icd10Code: "E11.9", context: "death" }), diag({ icd10Code: "E10", patient: { birthDate: d("2010-01-01"), gender: "F" } })], "IV.4.1");
    const [type1, type2] = t.rows;
    assert.equal(type1.cells.under21_F, 1);
    assert.equal(type2.total, 1);
    assert.equal(type2.deaths, 1);
    assert.equal(type2.deathCells?.age21plus_M, 1);
  });

  it("counts the ICD-10 sub-code rows (schistosomiasis, leprosy) and keeps the total row", () => {
    const t = table([diag({ icd10Code: "B65.0" }), diag({ icd10Code: "A30.5" })], "IV.5");
    const byLabel = (label: string) => t.rows.find((r) => r.label === label)!.total;
    assert.equal(byLabel("Schistosomiase urinaire"), 1);
    assert.equal(byLabel("Schistosomiase intestinale"), 0);
    assert.equal(byLabel("Schistosomiase (urinaire et intestinale)"), 1);
    assert.equal(byLabel("Lèpre multibacillaire (toutes)"), 1);
  });

  it("counts HTA diagnoses by age and sex", () => {
    const t = table([diag({ icd10Code: "I10" })], "IV.4.4");
    assert.equal(t.rows[0].cells.age40plus_M, 1);
  });
});

describe("parseRma3ActIndicator", () => {
  it("accepts known codes and clears with null or empty", () => {
    assert.equal(parseRma3ActIndicator("IV.4.11-014"), "IV.4.11-014");
    assert.equal(parseRma3ActIndicator(""), null);
    assert.equal(parseRma3ActIndicator(null), null);
    assert.equal(parseRma3ActIndicator("IV.4.11-099"), "invalid");
  });
});
