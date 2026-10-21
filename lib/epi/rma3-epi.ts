import { RMA3_AGE_SCHEMES, ageBand, rma3Sex } from "@/lib/reports/age-bands";
import type { PopulationGroup, VaccinationStrategy } from "@/lib/epi/input";

// RMA3 EPI tables built from the vaccination records. Pure, unit-tested in rma3-epi.test.ts.
//  - III.1 sessions planned / held, fixed and outreach;
//  - III.2 doses per antigen and dose: age band × strategy, sex, special populations;
//  - III.3 HPV: girls / boys of 9 and 10-13 years, fixed / outreach / refugees;
//  - III.4 cold chain: equipment, min / max temperatures and alarms of the month;
//  - III.6 AEFI (MAPI) per vaccine: minor / serious.

// ── III.1 Sessions ──────────────────────────────────────────────────────────

export interface SessionLike {
  strategy: VaccinationStrategy;
  status: "planned" | "held" | "cancelled";
}

export type Rma3SessionCounts = Record<VaccinationStrategy, { planned: number; held: number }>;

// Every session scheduled in the month was planned (cancelled ones included); held ones
// were carried out.
export function countSessions(sessions: readonly SessionLike[]): Rma3SessionCounts {
  const counts: Rma3SessionCounts = { fixed: { planned: 0, held: 0 }, outreach: { planned: 0, held: 0 } };
  for (const s of sessions) {
    counts[s.strategy].planned += 1;
    if (s.status === "held") counts[s.strategy].held += 1;
  }
  return counts;
}

// ── III.2 Doses ─────────────────────────────────────────────────────────────

export interface DoseLike {
  antigenCode: string;
  antigenName: string;
  doseNumber: number;
  administeredAt: Date;
  isOutOfSchedule: boolean;
  strategy: VaccinationStrategy;
  populationGroup: PopulationGroup;
  patient: { gender: string | null; birthDate: Date };
}

export type VaccinationBand = (typeof RMA3_AGE_SCHEMES.vaccination)[number]["key"];

export interface Rma3VaccinationRow {
  antigenCode: string;
  antigenName: string;
  doseNumber: number;
  boys: number;
  girls: number;
  unknownSex: number;
  total: number;
  ageUnder12m: number;
  age12to23m: number;
  age24to59m: number;
  age5yPlus: number;
  // Same age bands, split by strategy.
  byStrategy: Record<VaccinationStrategy, Record<VaccinationBand, number>>;
  // "dont" special populations.
  nomad: number;
  pygmy: number;
  refugee: number;
  outOfSchedule: number;
}

const emptyBands = (): Record<VaccinationBand, number> => ({ ageUnder12m: 0, age12to23m: 0, age24to59m: 0, age5yPlus: 0 });

// One row per antigen and dose, in the catalog order (`order`: antigen code → rank).
export function buildVaccinationRows(doses: readonly DoseLike[], order: ReadonlyMap<string, number>): Rma3VaccinationRow[] {
  const grouped = new Map<string, Rma3VaccinationRow>();
  for (const dose of doses) {
    const key = `${dose.antigenCode}:${dose.doseNumber}`;
    let row = grouped.get(key);
    if (!row) {
      row = {
        antigenCode: dose.antigenCode,
        antigenName: dose.antigenName,
        doseNumber: dose.doseNumber,
        boys: 0,
        girls: 0,
        unknownSex: 0,
        total: 0,
        ...emptyBands(),
        byStrategy: { fixed: emptyBands(), outreach: emptyBands() },
        nomad: 0,
        pygmy: 0,
        refugee: 0,
        outOfSchedule: 0,
      };
      grouped.set(key, row);
    }
    const sex = rma3Sex(dose.patient.gender);
    if (sex === "M") row.boys += 1;
    else if (sex === "F") row.girls += 1;
    else row.unknownSex += 1;
    row.total += 1;
    // Open-ended from birth: always a band.
    const band = ageBand(RMA3_AGE_SCHEMES.vaccination, dose.patient.birthDate, dose.administeredAt)!;
    row[band] += 1;
    row.byStrategy[dose.strategy][band] += 1;
    if (dose.populationGroup !== "general") row[dose.populationGroup] += 1;
    if (dose.isOutOfSchedule) row.outOfSchedule += 1;
  }
  return [...grouped.values()].sort((a, b) => {
    const rank = (order.get(a.antigenCode) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.antigenCode) ?? Number.MAX_SAFE_INTEGER);
    return rank || a.antigenCode.localeCompare(b.antigenCode) || a.doseNumber - b.doseNumber;
  });
}

// ── III.3 HPV ───────────────────────────────────────────────────────────────

export interface Rma3HpvRow {
  label: string;
  fixed: number;
  outreach: number;
  refugees: number;
}

// HPV doses of the month by age at the dose; doses outside 9-13 years are not in the form.
export function buildHpvRows(doses: readonly DoseLike[]): Rma3HpvRow[] {
  const rows: Record<string, Rma3HpvRow> = {
    age9_F: { label: "Filles de 9 ans", fixed: 0, outreach: 0, refugees: 0 },
    age9_M: { label: "Garçons de 9 ans", fixed: 0, outreach: 0, refugees: 0 },
    age10to13_F: { label: "Filles de 10-13 ans", fixed: 0, outreach: 0, refugees: 0 },
    age10to13_M: { label: "Garçons de 10-13 ans", fixed: 0, outreach: 0, refugees: 0 },
  };
  for (const dose of doses) {
    const band = ageBand(RMA3_AGE_SCHEMES.hpv, dose.patient.birthDate, dose.administeredAt);
    const sex = rma3Sex(dose.patient.gender);
    if (!band || !sex) continue;
    const row = rows[`${band}_${sex}`];
    row[dose.strategy] += 1;
    if (dose.populationGroup === "refugee") row.refugees += 1;
  }
  return Object.values(rows);
}

// ── III.4 Cold chain ────────────────────────────────────────────────────────

export interface EquipmentLike {
  id: string;
  status: "functional" | "needs_repair" | "out_of_service";
  minTempC: number;
  maxTempC: number;
}

export interface ReadingLike {
  equipmentId: string;
  temperatureC: number;
}

export interface Rma3ColdChain {
  equipmentTotal: number;
  equipmentFunctional: number;
  minTemperature: number | null;
  maxTemperature: number | null;
  // Readings below / above the range of their equipment (+2 / +8 °C for refrigerators).
  lowAlarms: number;
  highAlarms: number;
  readings: number;
  // Active equipment without any reading in the month (monitoring gap).
  equipmentWithoutReadings: number;
}

export function summarizeColdChain(equipment: readonly EquipmentLike[], readings: readonly ReadingLike[]): Rma3ColdChain {
  const byId = new Map(equipment.map((e) => [e.id, e]));
  const read = new Set<string>();
  const summary: Rma3ColdChain = {
    equipmentTotal: equipment.length,
    equipmentFunctional: equipment.filter((e) => e.status === "functional").length,
    minTemperature: null,
    maxTemperature: null,
    lowAlarms: 0,
    highAlarms: 0,
    readings: 0,
    equipmentWithoutReadings: 0,
  };
  for (const r of readings) {
    const eq = byId.get(r.equipmentId);
    if (!eq) continue;
    read.add(eq.id);
    summary.readings += 1;
    summary.minTemperature = summary.minTemperature === null ? r.temperatureC : Math.min(summary.minTemperature, r.temperatureC);
    summary.maxTemperature = summary.maxTemperature === null ? r.temperatureC : Math.max(summary.maxTemperature, r.temperatureC);
    if (r.temperatureC < eq.minTempC) summary.lowAlarms += 1;
    if (r.temperatureC > eq.maxTempC) summary.highAlarms += 1;
  }
  summary.equipmentWithoutReadings = equipment.filter((e) => !read.has(e.id)).length;
  return summary;
}

// ── III.6 AEFI ──────────────────────────────────────────────────────────────

export interface AefiLike {
  seriousness: "minor" | "serious";
  antigenCode: string;
}

export interface Rma3AefiRow {
  label: string;
  minor: number;
  serious: number;
}

// RMA3 rows in form order, keyed by the vaccine group of the antigen catalog.
const AEFI_GROUPS: [group: string, label: string][] = [
  ["BCG", "BCG"],
  ["PENTA", "Penta"],
  ["ROTA", "Rota"],
  ["OPV", "VPO"],
  ["VPI", "VPI"],
  ["RR", "RR"],
  ["VAA", "VAA"],
  ["PCV", "PCV13"],
  ["MALARIA", "Paludisme"],
  ["TD", "Td"],
  ["HepB0", "HepB"],
  ["HPV", "HPV"],
  ["COVID", "COVID-19"],
];

// `groupOf`: antigen code → catalog group. Every RMA3 vaccine has a row (zeros included);
// reports on other groups follow under their group name.
export function buildAefiRows(reports: readonly AefiLike[], groupOf: ReadonlyMap<string, string | null>): Rma3AefiRow[] {
  const rows = new Map<string, Rma3AefiRow>(AEFI_GROUPS.map(([group, label]) => [group.toUpperCase(), { label, minor: 0, serious: 0 }]));
  for (const report of reports) {
    const group = (groupOf.get(report.antigenCode) ?? report.antigenCode).toUpperCase();
    let row = rows.get(group);
    if (!row) {
      row = { label: groupOf.get(report.antigenCode) ?? report.antigenCode, minor: 0, serious: 0 };
      rows.set(group, row);
    }
    row[report.seriousness] += 1;
  }
  return [...rows.values()];
}
