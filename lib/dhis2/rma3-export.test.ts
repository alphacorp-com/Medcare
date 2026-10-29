import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDataValues,
  buildDataValueSet,
  chunk,
  dataValuesToCsv,
  isMonthlyPeriod,
  mappingCoverage,
  mappingTemplateCsv,
  parseMappingCsv,
  type Rma3Mapping,
} from "./rma3-export";
import type { Rma3IndicatorValue } from "./rma3-values";

const value = (indicatorCode: string, cellKey: string, v: number, label = "Indicateur", cellLabel = "", tableKey = "t"): Rma3IndicatorValue => ({ indicatorCode, tableKey, cellKey, label, cellLabel, value: v, origin: "computed" });
const mapping = (indicatorCode: string, cellKey: string, dataElementId: string, coc: string | null = null, tableKey = "t"): Rma3Mapping => ({ indicatorCode, tableKey, cellKey, dataElementId, categoryOptionComboId: coc });

const DE1 = "aBcDeFgHiJk";
const DE2 = "zYxWvUtSrQp";
const COC1 = "Lm0Np1Qr2St";
const COC2 = "Uv3Wx4Yz5Ab";

test("buildDataValues maps what it can and reports the rest", () => {
  const values = [value("RMA3-A-001", "", 5), value("RMA3-A-002", "f", 3), value("RMA3-A-002", "m", 4)];
  const { dataValues, unmapped, collisions } = buildDataValues(values, [mapping("RMA3-A-001", "", DE1), mapping("RMA3-A-002", "f", DE2, COC1)]);
  assert.deepEqual(dataValues, [{ dataElement: DE1, value: "5" }, { dataElement: DE2, categoryOptionCombo: COC1, value: "3" }]);
  assert.deepEqual(unmapped.map((v) => `${v.indicatorCode}/${v.cellKey}`), ["RMA3-A-002/m"]);
  assert.equal(collisions.length, 0);
});

test("two cells mapped to the same DHIS2 target: the second is reported, never sent", () => {
  const values = [value("RMA3-A-001", "", 5), value("RMA3-A-002", "", 9)];
  const { dataValues, collisions } = buildDataValues(values, [mapping("RMA3-A-001", "", DE1, COC1), mapping("RMA3-A-002", "", DE1, COC1)]);
  assert.equal(dataValues.length, 1);
  assert.equal(dataValues[0].value, "5");
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].second.indicatorCode, "RMA3-A-002");
});

test("data value set and CSV carry the same values; the CSV uses DHIS2's header", () => {
  const dataValues = [{ dataElement: DE1, value: "5" }, { dataElement: DE2, categoryOptionCombo: COC1, value: "3" }];
  assert.deepEqual(buildDataValueSet({ dataSetId: "dSetUid0001", orgUnitId: "orgUnitUid1", period: "202610", dataValues }), { dataSet: "dSetUid0001", orgUnit: "orgUnitUid1", period: "202610", dataValues });
  const lines = dataValuesToCsv({ orgUnitId: "orgUnitUid1", period: "202610", dataValues }).split("\r\n");
  assert.equal(lines[0], "dataelement,period,orgunit,categoryoptioncombo,attributeoptioncombo,value");
  assert.equal(lines[1], `${DE1},202610,orgUnitUid1,,,5`);
  assert.equal(lines[2], `${DE2},202610,orgUnitUid1,${COC1},,3`);
});

test("isMonthlyPeriod and chunk", () => {
  assert.equal(isMonthlyPeriod("202610"), true);
  for (const bad of ["202613", "2026-10", "20261", "", "202600"]) assert.equal(isMonthlyPeriod(bad), false, bad);
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});

const known = [value("RMA3-A-001", "", 0), value("RMA3-A-002", "f", 0, "x", "Femmes"), value("RMA3-A-002", "m", 0, "x", "Hommes")];

test("the mapping template lists every cell and is filled where a mapping exists", () => {
  const csv = mappingTemplateCsv(known, [mapping("RMA3-A-002", "f", DE2, COC1)]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "indicator_code,table_key,cell_key,indicator_label,cell_label,data_element_id,category_option_combo_id");
  assert.equal(lines.length, 4);
  assert.equal(lines[2], `RMA3-A-002,t,f,x,Femmes,${DE2},${COC1}`);
  assert.equal(lines[3], "RMA3-A-002,t,m,x,Hommes,,");
});

test("a filled template round-trips through parseMappingCsv", () => {
  const filled = mappingTemplateCsv(known, [mapping("RMA3-A-001", "", DE1), mapping("RMA3-A-002", "f", DE2, COC1)]);
  const result = parseMappingCsv(filled, known);
  assert.deepEqual(result.errors, []);
  assert.equal(result.skipped, 1, "the unmapped line is skipped, not an error");
  assert.deepEqual(result.mappings, [mapping("RMA3-A-001", "", DE1), mapping("RMA3-A-002", "f", DE2, COC1)]);
});

test("parseMappingCsv accepts an Excel BOM, upper-case headers and codes without the RMA3- prefix", () => {
  const csv = `﻿INDICATOR_CODE,TABLE_KEY,CELL_KEY\n` + `A-001,t,\n`;
  // header without data_element_id → rejected with the missing column
  assert.deepEqual(parseMappingCsv(csv, known).errors, [{ line: 1, message: "missing_column:data_element_id" }]);
  const ok = parseMappingCsv(`﻿INDICATOR_CODE,TABLE_KEY,CELL_KEY,DATA_ELEMENT_ID\nA-001,t,,${DE1}\n`, known);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.mappings[0].indicatorCode, "RMA3-A-001");
});

test("parseMappingCsv rejects bad identifiers, unknown cells and duplicates, with their line", () => {
  const csv = [
    "indicator_code,table_key,cell_key,data_element_id,category_option_combo_id",
    `RMA3-A-001,t,,not-a-uid,`, // line 2
    `RMA3-A-002,t,f,${DE1},bad`, // line 3
    `RMA3-NOPE-001,t,,${DE1},`, // line 4
    `RMA3-A-002,t,m,${DE1},`, // line 5 (valid)
    `RMA3-A-002,t,m,${DE2},`, // line 6 duplicate
    `RMA3-A-002,t,x,${DE1},`, // line 7 unknown cell
    `RMA3-A-002,other,m,${DE1},`, // line 8 right code and cell, wrong table
  ].join("\n");
  const { errors, mappings } = parseMappingCsv(csv, known);
  assert.deepEqual(errors, [
    { line: 2, message: "invalid_data_element_id" },
    { line: 3, message: "invalid_category_option_combo_id" },
    { line: 4, message: "unknown_indicator_or_cell" },
    { line: 6, message: "duplicate_line" },
    { line: 7, message: "unknown_indicator_or_cell" },
    { line: 8, message: "unknown_indicator_or_cell" },
  ]);
  assert.equal(mappings.length, 1);
});

test("the same code in two tables maps independently", () => {
  const values = [value("RMA3-A-001", "", 1, "x", "", "t1"), value("RMA3-A-001", "", 2, "x", "", "t2")];
  const { dataValues, unmapped } = buildDataValues(values, [mapping("RMA3-A-001", "", DE1, null, "t2")]);
  assert.deepEqual(dataValues, [{ dataElement: DE1, value: "2" }]);
  assert.deepEqual(unmapped.map((v) => v.tableKey), ["t1"]);
});

test("mappingCoverage counts cells and fully mapped indicators", () => {
  const coverage = mappingCoverage(known, [mapping("RMA3-A-001", "", DE1), mapping("RMA3-A-002", "f", DE2, COC1)]);
  assert.deepEqual(coverage, { cells: 3, mappedCells: 2, indicators: 2, fullyMappedIndicators: 1 });
});

test("COC2 is a valid UID shape (guards the fixtures themselves)", () => {
  assert.match(COC2, /^[A-Za-z][A-Za-z0-9]{10}$/);
});
