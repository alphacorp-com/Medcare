import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RMA3_RUBRICS } from "@/lib/reports/rma3-rubrics-default";
import { findOverlaps, findRubricForCode, parseIcd10Ranges } from "@/lib/diagnoses/icd10-ranges";

const section = (s: string) => DEFAULT_RMA3_RUBRICS.filter((r) => r.section === s);

describe("default RMA3 cause rubrics", () => {
  it("cover the 27 / 36 / 36 rubrics of the RMA3 dictionary, with unique codes", () => {
    assert.equal(section("V.3").length, 27);
    assert.equal(section("V.4").length, 36);
    assert.equal(section("V.5").length, 36);
    const codes = DEFAULT_RMA3_RUBRICS.map((r) => r.code);
    assert.equal(new Set(codes).size, codes.length);
    assert.ok(codes.filter((c) => c.startsWith("RMA3-V.")).every((c) => /^RMA3-V\.[345]-\d{3}$/.test(c)));
    // Codes and sections must fit their columns (code VarChar(30), section VarChar(10)).
    assert.ok(DEFAULT_RMA3_RUBRICS.every((r) => r.code.length <= 30 && r.section.length <= 10 && r.code.startsWith(`RMA3-${r.section}-`)));
  });

  it("only use valid ICD-10 ranges", () => {
    for (const r of DEFAULT_RMA3_RUBRICS) {
      assert.ok(parseIcd10Ranges(r.icd10Ranges).ok, `${r.code}: ${r.icd10Ranges}`);
    }
  });

  it("never claim a category in two active rubrics of the same table", () => {
    for (const s of ["V.3", "V.4", "V.5"]) {
      assert.deepEqual(findOverlaps(section(s)), [], s);
    }
  });

  it("route typical diagnoses to the expected cause", () => {
    const v3 = section("V.3");
    assert.equal(findRubricForCode("B50.9", v3)?.label, "Paludisme");
    assert.equal(findRubricForCode("J18", v3)?.label, "Affections aiguës des voies respiratoires inférieures");
    assert.equal(findRubricForCode("T21", v3)?.label, "Brûlures et corrosions");
    assert.equal(findRubricForCode("S72", v3)?.label, "Lésions traumatiques");
    const v5 = section("V.5");
    assert.equal(findRubricForCode("A39", v5)?.label, "Méningite bactérienne");
    assert.equal(findRubricForCode("C50", v5)?.label, "Tumeurs malignes");
    assert.equal(findRubricForCode("R50", v5), null, "symptoms are not an RMA3 cause");
  });

  it("seed the dictionary duplicates inactive so nothing is counted twice", () => {
    const inactive = section("V.4").filter((r) => !r.isActive).map((r) => r.code);
    assert.deepEqual(inactive, ["RMA3-V.4-032", "RMA3-V.4-035"]);
  });
});
