import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { breakdownColumns, buildMorbidityTables, columnFor, type MorbidityDiagnosis } from "@/lib/reports/rma3-morbidity";
import { DEFAULT_MORBIDITY_RUBRICS, RMA3_MORBIDITY_SECTIONS, RMA3_NOT_DERIVABLE } from "@/lib/reports/rma3-morbidity-default";
import { parseIcd10Ranges } from "@/lib/diagnoses/icd10-ranges";

const at = new Date("2026-10-15T10:00:00Z");
const born = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toddler = { birthDate: born("2024-01-01"), gender: "F" as const }; // 2 years
const sixYears = { birthDate: born("2020-06-01"), gender: "M" as const };
const man = { birthDate: born("1980-01-01"), gender: "M" as const }; // 46 years
const elder = { birthDate: born("1950-01-01"), gender: "F" as const }; // 76 years
const unknownSex = { birthDate: born("1990-01-01"), gender: "U" as const };

const dx = (icd10Code: string, patient: MorbidityDiagnosis["patient"], extra: Partial<MorbidityDiagnosis> = {}): MorbidityDiagnosis => ({
  context: "consultation",
  icd10Code,
  isNewCase: true,
  recordedAt: at,
  patient,
  ...extra,
});

describe("default morbidity rubrics", () => {
  it("only use valid ICD-10 ranges and cover every section", () => {
    for (const r of DEFAULT_MORBIDITY_RUBRICS) assert.ok(parseIcd10Ranges(r.icd10Ranges).ok, `${r.code}: ${r.icd10Ranges}`);
    for (const { section } of RMA3_MORBIDITY_SECTIONS) {
      assert.ok(DEFAULT_MORBIDITY_RUBRICS.some((r) => r.section === section), section);
      // What the section cannot produce from a diagnosis (empty when fully produced).
      assert.ok(Array.isArray(RMA3_NOT_DERIVABLE[section]), `${section} lists what it cannot produce`);
    }
  });
});

describe("columnFor", () => {
  it("applies the age bands at the date of the consultation, inclusive upper bounds", () => {
    assert.equal(columnFor("mentalAgeSex", born("2016-10-15"), "M", at), "age0to10_M"); // exactly 10
    assert.equal(columnFor("mentalAgeSex", born("2015-10-14"), "F", at), "age11to20_F"); // 11
    assert.equal(columnFor("mentalAgeSex", elder.birthDate, "F", at), "age56plus_F");
    assert.equal(columnFor("eyeAge", born("1977-01-01"), "M", at), "age15to49"); // 49
    assert.equal(columnFor("eyeAge", born("1976-10-15"), "M", at), "age50plus"); // 50
    assert.equal(columnFor("under5Sex", born("2021-10-16"), "F", at), "under5_F"); // 4 years 11 months
  });

  it("keeps patients without a recorded sex in the total only, and excludes children over 5 from PCIMNE", () => {
    assert.equal(columnFor("sex", unknownSex.birthDate, "U", at), "");
    assert.equal(columnFor("under5", toddler.birthDate, "F", at), "age0to59m");
    assert.equal(columnFor("under5", sixYears.birthDate, "M", at), null);
    assert.equal(columnFor("none", man.birthDate, "M", at), "");
  });

  it("builds one column per band × sex", () => {
    assert.deepEqual(breakdownColumns("eyeAgeSex").map((c) => c.key), ["age0to14_M", "age0to14_F", "age15to49_M", "age15to49_F", "age50plus_M", "age50plus_F"]);
    assert.deepEqual(breakdownColumns("none"), []);
  });
});

describe("buildMorbidityTables", () => {
  const tables = buildMorbidityTables(DEFAULT_MORBIDITY_RUBRICS, [
    dx("A09", toddler), // diarrhoea, under 5
    dx("A09", sixYears), // diarrhoea, over 5: not PCIMNE
    dx("J18.9", toddler), // pneumonia (sub-code)
    dx("K74", man), // cirrhosis
    dx("K74", man, { isNewCase: false }), // follow-up visit: not a new case
    dx("G40", unknownSex), // epilepsy, sex not recorded
    dx("G40", man, { context: "death" }), // death from epilepsy
    dx("G40", man, { context: "discharge" }), // discharge diagnoses are not counted here
    dx("F32", elder), // depression: also counted in "first mental health consultation"
    dx("C50", elder), // breast cancer
  ]);
  const table = (s: string) => tables.find((t) => t.section === s)!;
  const row = (s: string, label: string) => table(s).rows.find((r) => r.label.startsWith(label))!;

  it("counts PCIMNE cases for children under 5 only, sub-codes included", () => {
    assert.equal(row("III.7", "Cas de diarrhée").total, 1);
    assert.equal(row("III.7", "Enfants souffrant de pneumonie").total, 1);
  });

  it("counts new cases only, and deaths in their own column", () => {
    const cirrhosis = row("IV.4", "Cirrhose (total)");
    assert.equal(cirrhosis.total, 1);
    assert.equal(cirrhosis.cells.M, 1);
    const epilepsy = row("IV.4", "Épilepsie");
    assert.equal(epilepsy.total, 1, "the unknown-sex case is in the total");
    assert.equal(epilepsy.cells.M + epilepsy.cells.F, 0);
    assert.equal(epilepsy.deaths, 1);
  });

  it("counts a diagnosis in every rubric covering it (non-exclusive sections)", () => {
    assert.equal(row("IV.4.9", "Dépression").cells["age56plus_F"], 1);
    assert.equal(row("IV.4.9", "Première consultation").cells["age56plus_F"], 1);
    assert.equal(row("II.2", "Cas de cancer du sein").total, 1);
    assert.equal(row("IV.5", "Pian").total, 0);
  });

  it("has no deaths column where the form has none, and skips inactive rubrics", () => {
    assert.equal(row("IV.5", "Pian").deaths, null);
    const [first] = DEFAULT_MORBIDITY_RUBRICS.filter((r) => r.section === "IV.5");
    const withInactive = buildMorbidityTables(
      DEFAULT_MORBIDITY_RUBRICS.map((r) => (r.code === first.code ? { ...r, isActive: false } : r)),
      []
    );
    assert.ok(!withInactive.find((t) => t.section === "IV.5")!.rows.some((r) => r.code === first.code));
  });
});
