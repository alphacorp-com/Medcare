import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCauseTables, type CauseDiagnosis } from "@/lib/reports/rma3-rubrics";
import { DEFAULT_RMA3_RUBRICS } from "@/lib/reports/rma3-rubrics-default";

const at = new Date("2026-10-15T10:00:00Z");
const child = { birthDate: new Date("2024-01-01T00:00:00Z") }; // 2 years
const teen = { birthDate: new Date("2016-01-01T00:00:00Z") }; // 10 years
const adult = { birthDate: new Date("1980-01-01T00:00:00Z") };
const dx = (context: CauseDiagnosis["context"], icd10Code: string, patient = adult): CauseDiagnosis => ({ context, icd10Code, recordedAt: at, patient });

describe("buildCauseTables", () => {
  const tables = buildCauseTables(DEFAULT_RMA3_RUBRICS, [
    dx("consultation", "B50.9", child),
    dx("consultation", "B54", teen),
    dx("consultation", "B53"),
    dx("consultation", "R50"), // symptom: no rubric
    dx("discharge", "B50"),
    dx("death", "A39", child),
  ]);
  const table = (s: string) => tables.find((t) => t.section === s)!;
  const row = (s: string, label: string) => table(s).rows.find((r) => r.label === label)!;

  it("routes each diagnosis to the table of its context only", () => {
    assert.equal(row("V.3", "Paludisme").total, 3);
    assert.equal(row("V.4", "Paludisme").total, 1);
    assert.equal(row("V.5", "Paludisme").total, 0);
    assert.equal(row("V.5", "Méningite bactérienne").total, 1);
  });

  it("splits by age at the date of the event", () => {
    const malaria = row("V.3", "Paludisme");
    assert.deepEqual([malaria.age0to59m, malaria.age5to14, malaria.age15plus], [1, 1, 1]);
  });

  it("keeps unmapped diagnoses visible instead of dropping them", () => {
    assert.equal(table("V.3").unclassified.total, 1);
    assert.equal(table("V.4").unclassified.total, 0);
  });

  it("lists active rubrics only, in order, and conserves the total", () => {
    assert.equal(table("V.4").rows.length, 34); // 36 minus the 2 inactive duplicates
    for (const t of tables) {
      const sum = t.rows.reduce((n, r) => n + r.total, 0) + t.unclassified.total;
      const expected = { "V.3": 4, "V.4": 1, "V.5": 1 }[t.section];
      assert.equal(sum, expected, t.section);
    }
  });
});
