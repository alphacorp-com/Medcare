import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAefiRows, buildHpvRows, buildVaccinationRows, countSessions, summarizeColdChain, type DoseLike } from "@/lib/epi/rma3-epi";

const at = new Date("2026-10-15T10:00:00Z");
const born = (iso: string) => new Date(`${iso}T00:00:00Z`);
const dose = (overrides: Partial<DoseLike> = {}): DoseLike => ({
  antigenCode: "PENTA1",
  antigenName: "Penta 1",
  doseNumber: 1,
  administeredAt: at,
  isOutOfSchedule: false,
  strategy: "fixed",
  populationGroup: "general",
  patient: { gender: "F", birthDate: born("2026-08-01") },
  ...overrides,
});

describe("countSessions", () => {
  it("counts every scheduled session as planned and the held ones as held", () => {
    const counts = countSessions([
      { strategy: "fixed", status: "held" },
      { strategy: "fixed", status: "planned" },
      { strategy: "outreach", status: "cancelled" },
      { strategy: "outreach", status: "held" },
    ]);
    assert.deepEqual(counts, { fixed: { planned: 2, held: 1 }, outreach: { planned: 2, held: 1 } });
  });
});

describe("buildVaccinationRows", () => {
  const rows = buildVaccinationRows(
    [
      dose(),
      dose({ strategy: "outreach", populationGroup: "refugee", patient: { gender: "M", birthDate: born("2025-06-01") } }), // 16 months
      dose({ strategy: "outreach", populationGroup: "pygmy" }),
      dose({ antigenCode: "BCG", antigenName: "BCG", isOutOfSchedule: true, patient: { gender: "U", birthDate: born("2026-10-01") } }),
    ],
    new Map([["BCG", 1], ["PENTA1", 9]])
  );

  it("orders rows like the catalog", () => {
    assert.deepEqual(rows.map((r) => r.antigenCode), ["BCG", "PENTA1"]);
  });

  it("splits each age band by strategy and counts the special populations", () => {
    const penta = rows[1];
    assert.equal(penta.total, 3);
    assert.deepEqual(penta.byStrategy.fixed, { ageUnder12m: 1, age12to23m: 0, age24to59m: 0, age5yPlus: 0 });
    assert.deepEqual(penta.byStrategy.outreach, { ageUnder12m: 1, age12to23m: 1, age24to59m: 0, age5yPlus: 0 });
    assert.deepEqual([penta.boys, penta.girls], [1, 2]);
    assert.deepEqual([penta.nomad, penta.pygmy, penta.refugee], [0, 1, 1]);
    assert.equal(rows[0].unknownSex, 1);
    assert.equal(rows[0].outOfSchedule, 1);
  });
});

describe("buildHpvRows", () => {
  it("counts girls and boys of 9 and 10-13 years by strategy, refugees apart", () => {
    const rows = buildHpvRows([
      dose({ antigenCode: "HPV1", patient: { gender: "F", birthDate: born("2017-05-01") } }), // 9 years
      dose({ antigenCode: "HPV1", strategy: "outreach", populationGroup: "refugee", patient: { gender: "F", birthDate: born("2014-01-01") } }), // 12
      dose({ antigenCode: "HPV1", patient: { gender: "M", birthDate: born("2010-01-01") } }), // 16: outside the form
    ]);
    assert.deepEqual(rows[0], { label: "Filles de 9 ans", fixed: 1, outreach: 0, refugees: 0 });
    assert.deepEqual(rows[2], { label: "Filles de 10-13 ans", fixed: 0, outreach: 1, refugees: 1 });
    assert.equal(rows.reduce((sum, r) => sum + r.fixed + r.outreach, 0), 2);
  });
});

describe("summarizeColdChain", () => {
  it("reports min / max and the readings outside each equipment's range", () => {
    const summary = summarizeColdChain(
      [
        { id: "F", status: "functional", minTempC: 2, maxTempC: 8 },
        { id: "C", status: "needs_repair", minTempC: -25, maxTempC: -15 },
        { id: "X", status: "functional", minTempC: 2, maxTempC: 8 },
      ],
      [
        { equipmentId: "F", temperatureC: 4 },
        { equipmentId: "F", temperatureC: 9.5 },
        { equipmentId: "F", temperatureC: 1 },
        { equipmentId: "C", temperatureC: -20 },
      ]
    );
    assert.deepEqual(summary, {
      equipmentTotal: 3,
      equipmentFunctional: 2,
      minTemperature: -20,
      maxTemperature: 9.5,
      lowAlarms: 1,
      highAlarms: 1,
      readings: 4,
      equipmentWithoutReadings: 1,
    });
  });
});

describe("buildAefiRows", () => {
  it("counts minor / serious per vaccine group, every RMA3 vaccine listed", () => {
    const rows = buildAefiRows(
      [
        { seriousness: "minor", antigenCode: "PENTA1" },
        { seriousness: "serious", antigenCode: "PENTA3" },
        { seriousness: "minor", antigenCode: "XYZ" },
      ],
      new Map([["PENTA1", "PENTA"], ["PENTA3", "PENTA"], ["XYZ", "Autre"]])
    );
    assert.deepEqual(rows.find((r) => r.label === "Penta"), { label: "Penta", minor: 1, serious: 1 });
    assert.deepEqual(rows.find((r) => r.label === "BCG"), { label: "BCG", minor: 0, serious: 0 });
    assert.deepEqual(rows.at(-1), { label: "Autre", minor: 1, serious: 0 });
  });
});
