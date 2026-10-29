import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenRma3Report, normalizeIndicatorCode } from "./rma3-values";

const emptyHiv = {
  hivTesting: [], artFollowUp: [], pmtctAntenatal: [], antenatalScreening: [], pmtctMaternity: [], pmtctReferrals: [], pmtctViralLoad: [], pmtctPostnatal: [], hepatitisSti: [],
};

// A report reduced to the sections the flattener reads.
function report(parts: Record<string, unknown>) {
  return { activity: [], morbidity: [], causes: [], hiv: emptyHiv, manual: { sections: [] }, ...parts } as unknown as Parameters<typeof flattenRma3Report>[0];
}

test("normalizeIndicatorCode adds the RMA3- prefix once", () => {
  assert.equal(normalizeIndicatorCode("II.1.1-002"), "RMA3-II.1.1-002");
  assert.equal(normalizeIndicatorCode("RMA3-II.1.1-002"), "RMA3-II.1.1-002");
});

test("activity rows: one value per breakdown column, zeros included by default", () => {
  const { values } = flattenRma3Report(
    report({
      activity: [
        {
          section: "II.1.1",
          title: "CPN",
          columns: [{ key: "f_15-19", label: "F 15-19 ans" }, { key: "f_20+", label: "F 20 ans et +" }],
          rows: [{ code: "II.1.1-002", label: "CPN1", cells: { "f_15-19": 3, "f_20+": 0 }, total: 3 }],
        },
      ],
    })
  );
  assert.deepEqual(
    values.map((v) => [v.indicatorCode, v.cellKey, v.cellLabel, v.value, v.origin]),
    [
      ["RMA3-II.1.1-002", "f_15-19", "F 15-19 ans", 3, "computed"],
      ["RMA3-II.1.1-002", "f_20+", "F 20 ans et +", 0, "computed"],
    ]
  );
});

test("includeZeros: false drops the zero cells of computed rows", () => {
  const { values } = flattenRma3Report(
    report({ activity: [{ section: "x", title: "x", columns: [{ key: "a", label: "A" }], rows: [{ code: "II.1.1-002", label: "x", cells: { a: 0 }, total: 0 }] }] }),
    { includeZeros: false }
  );
  assert.equal(values.length, 0);
});

test("a row without breakdown exports its total with an empty cell key", () => {
  const { values } = flattenRma3Report(report({ activity: [{ section: "x", title: "x", columns: [], rows: [{ code: "V.1-001", label: "Consultations", cells: {}, total: 42 }] }] }));
  assert.deepEqual(values.map((v) => [v.cellKey, v.value]), [["", 42]]);
});

test("morbidity: new cases per column and the deaths, by column or in total", () => {
  const { values } = flattenRma3Report(
    report({
      morbidity: [
        {
          columns: [{ key: "m", label: "H" }, { key: "f", label: "F" }],
          rows: [
            { code: "IV.4-001", label: "Épilepsie", cells: { m: 2, f: 1 }, total: 3, deaths: 1, deathCells: { m: 1, f: 0 } },
            { code: "IV.4-002", label: "Traumatismes", cells: { m: 5, f: 4 }, total: 9, deaths: 2 },
          ],
        },
      ],
    })
  );
  const get = (code: string, cell: string) => values.find((v) => v.indicatorCode === code && v.cellKey === cell)?.value;
  assert.equal(get("RMA3-IV.4-001", "m"), 2);
  assert.equal(get("RMA3-IV.4-001", "death:m"), 1);
  assert.equal(get("RMA3-IV.4-001", "death:f"), 0);
  assert.equal(get("RMA3-IV.4-002", "death"), 2);
  assert.equal(get("RMA3-IV.4-001", "death"), undefined, "per-column deaths replace the total");
});

test("causes: three age bands per rubric, rubric codes already prefixed", () => {
  const { values } = flattenRma3Report(
    report({ causes: [{ section: "V.3", rows: [{ code: "RMA3-V.3-001", label: "Paludisme", age0to59m: 4, age5to14: 2, age15plus: 7, total: 13 }], unclassified: { code: "", label: "", age0to59m: 0, age5to14: 0, age15plus: 0, total: 0 } }] })
  );
  assert.deepEqual(values.map((v) => [v.indicatorCode, v.cellKey, v.value]), [
    ["RMA3-V.3-001", "age0to59m", 4],
    ["RMA3-V.3-001", "age5to14", 2],
    ["RMA3-V.3-001", "age15plus", 7],
  ]);
});

test("HIV indicator rows are flattened like activity rows", () => {
  const { values } = flattenRma3Report(report({ hiv: { ...emptyHiv, hivTesting: [{ code: "IV.1.1-001", label: "Testés", scheme: "hiv13", cells: { "m_15+": 4 }, total: 4 }] } }));
  assert.deepEqual(values.map((v) => [v.indicatorCode, v.cellKey, v.value]), [["RMA3-IV.1.1-001", "m_15+", 4]]);
});

test("monthly form: only the cells entered, marked manual; a zero entered is kept", () => {
  const { values } = flattenRma3Report(
    report({
      manual: {
        sections: [
          {
            tables: [
              {
                columns: [{ key: "planned", label: "Prévues" }, { key: "held", label: "Tenues" }],
                rows: [
                  { code: "VI.2-001", label: "Séances", kind: "count", cells: { planned: 5, held: null }, total: 5 },
                  { code: "VI.2-002", label: "Autre", kind: "count", cells: { planned: 0 }, total: 0 },
                ],
              },
              { columns: [], rows: [{ code: "VI.3-D001", label: "Salaires", kind: "amount", cells: {}, total: 120000 }, { code: "VI.3-D002", label: "Jamais saisi", kind: "amount", cells: {}, total: null }] },
            ],
          },
        ],
      },
    }),
    { includeZeros: false }
  );
  assert.deepEqual(values.map((v) => [v.indicatorCode, v.cellKey, v.value, v.origin]), [
    ["RMA3-VI.2-001", "planned", 5, "manual"],
    ["RMA3-VI.2-002", "planned", 0, "manual"],
    ["RMA3-VI.3-D001", "", 120000, "manual"],
  ]);
});

test("the same code in two tables is two indicators; a repeat inside one table keeps the first and is reported", () => {
  const row = (total: number) => ({ code: "IV.4-001", label: "x", cells: {}, total });
  const two = flattenRma3Report(report({ activity: [{ section: "a", title: "a", columns: [], rows: [row(1)] }, { section: "b", title: "b", columns: [], rows: [row(2)] }] }));
  assert.deepEqual(two.values.map((v) => [v.tableKey, v.value]), [["activity:a:a", 1], ["activity:b:b", 2]]);
  assert.equal(two.duplicates.length, 0);

  const { values, duplicates } = flattenRma3Report(report({ activity: [{ section: "a", title: "a", columns: [], rows: [row(1), row(2)] }] }));
  assert.equal(values.length, 1);
  assert.equal(values[0].value, 1);
  assert.deepEqual(duplicates, [{ indicatorCode: "RMA3-IV.4-001", tableKey: "activity:a:a", cellKey: "" }]);
});
