import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretScreeningResult, labEntryPoint } from "@/lib/hiv/lab-link";
import type { ResultParameter } from "@/lib/laboratory/results";

const p = (value: string, flag: ResultParameter["flag"] = "normal"): ResultParameter => ({ name: "Résultat", value, unit: "", referenceRange: "", flag });

describe("interpretScreeningResult", () => {
  it("reads the usual French and English wordings, negatives first", () => {
    assert.equal(interpretScreeningResult([p("Non réactif")]), "negative");
    assert.equal(interpretScreeningResult([p("Réactif", "abnormal")]), "positive");
    assert.equal(interpretScreeningResult([p("NEGATIF")]), "negative");
    assert.equal(interpretScreeningResult([p("Positive")]), "positive");
    assert.equal(interpretScreeningResult([p("Non détecté")]), "negative");
    assert.equal(interpretScreeningResult([p("Indéterminé")]), "indeterminate");
    assert.equal(interpretScreeningResult([p("Test invalide")]), "invalid");
  });

  it("falls back on the flag, and gives up when nothing can be read", () => {
    assert.equal(interpretScreeningResult([p("1/80", "high")]), "positive");
    assert.equal(interpretScreeningResult([p("0.2", "normal")]), "negative");
    assert.equal(interpretScreeningResult([p("")]), null);
    assert.equal(interpretScreeningResult([]), null);
  });
});

describe("labEntryPoint", () => {
  it("derives the entry point from the exam context", () => {
    assert.equal(labEntryPoint({ pregnancyId: "x", stayType: "emergency" }), "antenatal");
    assert.equal(labEntryPoint({ pregnancyId: null, stayType: "emergency" }), "emergency");
    assert.equal(labEntryPoint({ pregnancyId: null, stayType: "scheduled" }), "inpatient");
    assert.equal(labEntryPoint({ pregnancyId: null, stayType: null }), "outpatient");
  });
});
