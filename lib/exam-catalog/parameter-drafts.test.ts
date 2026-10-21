import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blankDraft,
  definitionsFromDrafts,
  draftsFromDefinitions,
  duplicateDraft,
  fromDraft,
  kindOfDefinition,
  moveDraft,
  parseDecimal,
  toDraft,
} from "@/lib/exam-catalog/parameter-drafts";
import { validateExamParameters } from "@/lib/exam-catalog/validate-parameters";
import { LAB_PARAMETERS, RADIOLOGY_PARAMETERS } from "@/lib/exam-catalog/standard-parameters";

describe("parameter drafts", () => {
  it("round-trips every standard sheet without loss", () => {
    for (const [code, sheet] of Object.entries({ ...LAB_PARAMETERS, ...RADIOLOGY_PARAMETERS })) {
      assert.deepEqual(definitionsFromDrafts(draftsFromDefinitions(sheet)), sheet, `sheet ${code} changed`);
    }
  });

  it("infers the kind of a stored definition", () => {
    assert.equal(kindOfDefinition({ name: "a", unit: "", referenceRange: "", options: ["x"] }), "qualitative");
    assert.equal(kindOfDefinition({ name: "a", unit: "g/L", referenceRange: "", low: 1 }), "numeric");
    assert.equal(kindOfDefinition({ name: "a", unit: "", referenceRange: "", bySex: { F: { referenceRange: "x" } } }), "numeric");
    assert.equal(kindOfDefinition({ name: "a", unit: "", referenceRange: "Normal" }), "text");
  });

  it("parses decimals with a comma or a dot, and marks garbage as NaN", () => {
    assert.equal(parseDecimal("4,5"), 4.5);
    assert.equal(parseDecimal(" 10 "), 10);
    assert.equal(parseDecimal("-0.5"), -0.5);
    assert.equal(parseDecimal(""), undefined);
    assert.ok(Number.isNaN(parseDecimal("abc")));
    assert.ok(Number.isNaN(parseDecimal("1,2,3")));
  });

  it("makes invalid numbers fail validation instead of vanishing", () => {
    const draft = { ...blankDraft("numeric"), name: "Hb", low: "douze" };
    const result = validateExamParameters([fromDraft(draft)]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "not_a_number");
  });

  it("keeps only the fields of the selected kind", () => {
    const numeric = { ...blankDraft("numeric"), name: "Test", low: "1", high: "2", options: [{ value: "x", flag: "normal" as const }] };
    assert.deepEqual(fromDraft({ ...numeric, kind: "text" }), { name: "Test", unit: "", referenceRange: "" });
    assert.deepEqual(fromDraft({ ...numeric, kind: "qualitative" }), {
      name: "Test", unit: "", referenceRange: "", options: ["x"], normalOptions: ["x"],
    });
  });

  it("maps per-answer flags to normal/critical option lists", () => {
    const draft = toDraft({ name: "VIH", unit: "", referenceRange: "Négatif", options: ["Négatif", "Positif"], normalOptions: ["Négatif"] });
    assert.deepEqual(draft.options, [{ value: "Négatif", flag: "normal" }, { value: "Positif", flag: "abnormal" }]);
    draft.options[1].flag = "critical";
    assert.deepEqual(fromDraft(draft).criticalOptions, ["Positif"]);
  });

  it("drops sex-specific references when the option is turned off", () => {
    const draft = toDraft({ name: "Hb", unit: "g/dL", referenceRange: "x", bySex: { M: { referenceRange: "13 – 17", low: 13, high: 17 } } });
    assert.ok(fromDraft(draft).bySex);
    assert.equal(fromDraft({ ...draft, bySexEnabled: false }).bySex, undefined);
  });

  it("moves and duplicates rows without sharing nested objects", () => {
    const rows = [{ ...blankDraft(), name: "a" }, { ...blankDraft(), name: "b" }];
    assert.deepEqual(moveDraft(rows, 0, 1).map((d) => d.name), ["b", "a"]);
    assert.deepEqual(moveDraft(rows, 0, -1).map((d) => d.name), ["a", "b"]);
    const copied = duplicateDraft(rows, 0);
    assert.deepEqual(copied.map((d) => d.name), ["a", "a", "b"]);
    assert.notEqual(copied[0].key, copied[1].key);
    copied[1].male.low = "9";
    assert.equal(copied[0].male.low, "");
  });
});
