import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  codeMatchesItems,
  findOverlaps,
  findRubricForCode,
  formatIcd10Ranges,
  normalizeIcd10Code,
  parseIcd10Ranges,
} from "@/lib/diagnoses/icd10-ranges";

const items = (text: string) => {
  const parsed = parseIcd10Ranges(text);
  assert.ok(parsed.ok, `expected "${text}" to parse`);
  return parsed.ok ? parsed.items : [];
};

describe("normalizeIcd10Code", () => {
  it("accepts categories and sub-codes, case-insensitively", () => {
    assert.equal(normalizeIcd10Code(" b50 "), "B50");
    assert.equal(normalizeIcd10Code("b50.9"), "B50.9");
    assert.equal(normalizeIcd10Code("J45.01"), "J45.01");
  });
  it("rejects anything else", () => {
    for (const bad of ["", "B5", "B500", "50B", "B50.", "B50.123", "B50-B54", 42, null]) {
      assert.equal(normalizeIcd10Code(bad), null, String(bad));
    }
  });
});

describe("parseIcd10Ranges", () => {
  it("parses codes and ranges, ignoring blanks", () => {
    assert.deepEqual(parseIcd10Ranges(" B50-B54 , a39,, G00 ").ok, true);
    assert.equal(formatIcd10Ranges(items(" b50-b54 , a39,, G00 ")), "B50-B54, A39, G00");
  });
  it("accepts an empty list (rubric without mapping)", () => {
    assert.deepEqual(items(""), []);
  });
  it("rejects malformed tokens, inverted ranges and sub-code ranges", () => {
    assert.deepEqual(parseIcd10Ranges("B50-"), { ok: false, error: "invalid_token", token: "B50-" });
    assert.deepEqual(parseIcd10Ranges("B54-B50"), { ok: false, error: "inverted_range", token: "B54-B50" });
    assert.deepEqual(parseIcd10Ranges("B50.1-B54"), { ok: false, error: "range_needs_categories", token: "B50.1-B54" });
    assert.equal(parseIcd10Ranges("paludisme").ok, false);
    assert.equal(parseIcd10Ranges("B50-B52-B54").ok, false);
  });
});

describe("codeMatchesItems", () => {
  it("matches every code of the categories in a range, bounds included", () => {
    const malaria = items("B50-B54");
    for (const code of ["B50", "B50.9", "B52", "B54"]) assert.ok(codeMatchesItems(code, malaria), code);
    for (const code of ["B49", "B55", "A50"]) assert.ok(!codeMatchesItems(code, malaria), code);
  });
  it("a category covers its sub-codes; a sub-code only itself and its children", () => {
    assert.ok(codeMatchesItems("G00.1", items("A39, G00")));
    const schistoUrinary = items("B65.0");
    assert.ok(codeMatchesItems("B65.0", schistoUrinary));
    assert.ok(!codeMatchesItems("B65.1", schistoUrinary));
    assert.ok(!codeMatchesItems("B65", schistoUrinary));
  });
  it("never matches an invalid code", () => {
    assert.ok(!codeMatchesItems("not a code", items("A00-Z99")));
  });
});

describe("findRubricForCode", () => {
  const rubrics = [
    { code: "R-2", label: "Traumatismes", icd10Ranges: "S00-T14", order: 2, isActive: true },
    { code: "R-1", label: "Brûlures", icd10Ranges: "T20-T32", order: 1, isActive: true },
    { code: "R-3", label: "Doublon inactif", icd10Ranges: "T20-T32", order: 0, isActive: false },
    { code: "R-4", label: "Plage invalide", icd10Ranges: "T99-T01", order: 0, isActive: true },
  ];
  it("returns the first active rubric by order", () => {
    assert.equal(findRubricForCode("T21.3", rubrics)?.code, "R-1");
    assert.equal(findRubricForCode("S72", rubrics)?.code, "R-2");
  });
  it("skips inactive and unparseable rubrics, and returns null when nothing matches", () => {
    assert.equal(findRubricForCode("T25", rubrics)?.code, "R-1");
    assert.equal(findRubricForCode("A00", rubrics), null);
  });
});

describe("findOverlaps", () => {
  it("reports categories claimed by two active rubrics", () => {
    const overlaps = findOverlaps([
      { code: "A", label: "", icd10Ranges: "K20-K31", order: 1, isActive: true },
      { code: "B", label: "", icd10Ranges: "K29, K30.1", order: 2, isActive: true },
      { code: "C", label: "", icd10Ranges: "K20-K31", order: 3, isActive: false },
    ]);
    assert.deepEqual(overlaps, [
      { category: "K29", rubrics: ["A", "B"] },
      { category: "K30", rubrics: ["A", "B"] },
    ]);
  });
});
