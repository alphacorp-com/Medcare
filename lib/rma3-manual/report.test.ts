import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildManualReport, formatManualValue } from "@/lib/rma3-manual/report";
import { withSubModules } from "@/lib/utils";

describe("buildManualReport", () => {
  const report = buildManualReport({ "III.1-003": { planned: 4, held: 3 }, "II.1.4-002": { F: 0 }, "VI.1-001": { "": 1 } }, "draft", null);
  const row = (code: string) => report.sections.flatMap((s) => s.tables.flatMap((t) => t.rows)).find((r) => r.code === code)!;

  it("keeps a cell not entered apart from a zero", () => {
    assert.deepEqual(row("II.1.4-002").cells, { M: null, F: 0 });
    assert.equal(row("II.1.4-002").total, 0);
    assert.deepEqual(row("II.1.4-024").cells, { M: null, F: null });
    assert.equal(row("II.1.4-024").total, null);
  });

  it("totals the breakdown, but not a yes / no", () => {
    assert.equal(row("III.1-003").total, 7);
    assert.equal(row("VI.1-001").total, null);
  });

  it("counts the cells entered", () => {
    assert.equal(report.filledCells, 4);
    assert.ok(report.totalCells > 100);
  });

  it("splits a section into one table per breakdown", () => {
    const section = report.sections.find((s) => s.code === "II.1.2")!;
    assert.equal(section.tables.length, 1);
    assert.equal(section.tables[0].columns.length, 3);
  });
});

describe("formatManualValue", () => {
  it("prints not entered, yes / no and amounts", () => {
    assert.equal(formatManualValue(null, "count"), "—");
    assert.equal(formatManualValue(0, "count"), "0");
    assert.equal(formatManualValue(1, "yesNo"), "Oui");
    assert.equal(formatManualValue(0, "yesNo"), "Non");
    assert.equal(formatManualValue(1250000, "amount"), "1 250 000");
  });
});

describe("withSubModules", () => {
  it("gives an administrator the sub-modules of the licensed modules", () => {
    const all = ["read", "create", "update", "delete", "validate"] as const;
    const modules = withSubModules([{ moduleId: "MODULE_CORE_PATIENT", actions: [...all] }]);
    assert.deepEqual(modules.find((m) => m.moduleId === "MODULE_RMA3")?.actions, [...all]);
    // MODULE_DISEASE_PROGRAMS is not licensed: no MODULE_HIV.
    assert.equal(modules.some((m) => m.moduleId === "MODULE_HIV"), false);
  });
});
