import { test } from "node:test";
import assert from "node:assert/strict";
import { containsCode, proposeMappings, type Dhis2DataElementStructure } from "./rma3-mapping";

const cell = (indicatorCode: string, cellKey = "", cellLabel = "") => ({ indicatorCode, tableKey: "t", cellKey, cellLabel });

test("containsCode matches the whole code, with or without RMA3-, and never inside a longer one", () => {
  assert.equal(containsCode("[II.1.1-001] CPN1", "RMA3-II.1.1-001"), true);
  assert.equal(containsCode("RMA3-II.1.1-001 CPN1", "RMA3-II.1.1-001"), true);
  assert.equal(containsCode("rma3-ii.1.1-001", "RMA3-II.1.1-001"), true);
  assert.equal(containsCode("II.1.1-0011 autre", "RMA3-II.1.1-001"), false, "followed by a digit");
  assert.equal(containsCode("XII.1.1-001", "RMA3-II.1.1-001"), false, "glued to a letter");
  assert.equal(containsCode("1.II.1.1-001", "RMA3-II.1.1-001"), false, "glued to a dot");
  assert.equal(containsCode(null, "RMA3-II.1.1-001"), false);
});

const element = (over: Partial<Dhis2DataElementStructure> & { id: string }): Dhis2DataElementStructure => ({ name: "Élément", shortName: null, code: null, combos: [], ...over });

test("a data element with a default combo takes the indicator's single cell", () => {
  const { proposals, noElement } = proposeMappings([cell("RMA3-II.1.1-001"), cell("RMA3-IV.9-001")], [element({ id: "aBcDeFgHiJk", name: "[II.1.1-001] CPN1", combos: [{ id: "defaultCoc1", name: "default" }] })]);
  assert.deepEqual(proposals.map((p) => [p.indicatorCode, p.cellKey, p.dataElementId, p.categoryOptionComboId]), [["RMA3-II.1.1-001", "", "aBcDeFgHiJk", null]]);
  assert.equal(noElement, 1);
});

test("a disaggregated element: the combo is chosen by code, or by the same words as the cell label", () => {
  const de = element({
    id: "aBcDeFgHiJk",
    code: "RMA3-II.1.1-002",
    combos: [
      { id: "Lm0Np1Qr2St", name: "Femmes, 15-19 ans", code: null },
      { id: "Uv3Wx4Yz5Ab", name: "Femmes, 20 ans et +", code: "f_20+" },
    ],
  });
  const { proposals, noCombo } = proposeMappings(
    [cell("RMA3-II.1.1-002", "f_15-19", "15-19 ans, Femmes"), cell("RMA3-II.1.1-002", "f_20+", "sans rapport"), cell("RMA3-II.1.1-002", "m_15-19", "Hommes 15-19 ans")],
    [de]
  );
  assert.deepEqual(proposals.map((p) => [p.cellKey, p.categoryOptionComboId]), [["f_15-19", "Lm0Np1Qr2St"], ["f_20+", "Uv3Wx4Yz5Ab"]]);
  assert.equal(noCombo, 1, "no combo has the words of the third cell");
});

test("an ambiguous or missing data element gives no proposal", () => {
  const a = element({ id: "aBcDeFgHiJk", name: "CPN1 II.1.1-001", combos: [{ id: "defaultCoc1", name: "default" }] });
  const b = element({ id: "zYxWvUtSrQp", name: "CPN1 bis II.1.1-001", combos: [{ id: "defaultCoc1", name: "default" }] });
  const result = proposeMappings([cell("RMA3-II.1.1-001")], [a, b]);
  assert.equal(result.proposals.length, 0);
  assert.equal(result.ambiguousElement, 1);
});

test("a breakdown cell cannot go to a breakdown-less element", () => {
  const de = element({ id: "aBcDeFgHiJk", name: "II.1.1-003", combos: [{ id: "defaultCoc1", name: "default" }] });
  const result = proposeMappings([cell("RMA3-II.1.1-003", "f", "Femmes")], [de]);
  assert.equal(result.proposals.length, 0);
  assert.equal(result.noCombo, 1);
});

test("what is already mapped is left alone, and a non-UID id from the server is never proposed", () => {
  const de = element({ id: "aBcDeFgHiJk", name: "II.1.1-001", combos: [] });
  assert.equal(proposeMappings([cell("RMA3-II.1.1-001")], [de], [{ indicatorCode: "RMA3-II.1.1-001", tableKey: "t", cellKey: "" }]).proposals.length, 0);
  assert.equal(proposeMappings([cell("RMA3-II.1.1-001")], [element({ id: "bad id", name: "II.1.1-001" })]).proposals.length, 0);
});
