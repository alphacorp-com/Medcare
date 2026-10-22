import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { indicatorsToCsv } from "@/lib/hiv/rma3-csv";

describe("indicatorsToCsv", () => {
  it("writes one block per section with its columns, for Excel in French", () => {
    const csv = indicatorsToCsv([
      { title: "II.3.4", rows: [{ code: "II.3.4-001", label: 'Charge "virale"', scheme: "none", cells: {}, total: 3 }] },
      { title: "Vide", rows: [] },
      { title: "PTME", rows: [{ code: "X", label: "Y", scheme: "ptme", cells: { under15: 1, age25plus: 2 }, total: 3 }] },
    ]);
    assert.ok(csv.startsWith("\uFEFF"));
    const lines = csv.slice(1).split("\r\n");
    assert.equal(lines[0], '"II.3.4"');
    assert.equal(lines[1], '"Code";"Indicateur";"Total"');
    assert.equal(lines[2], '"II.3.4-001";"Charge ""virale""";3');
    assert.ok(!csv.includes("Vide"));
    assert.equal(lines[5], '"Code";"Indicateur";"< 15 ans";"15-19 ans";"20-24 ans";"25 ans et +";"Total"');
    assert.equal(lines[6], '"X";"Y";1;0;0;2;3');
  });
});
