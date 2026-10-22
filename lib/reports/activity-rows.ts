import { RMA3_SEXES, disaggregationColumns, disaggregationKey, emptyCells, type DisaggregationColumn } from "@/lib/reports/age-bands";

// Building blocks of the RMA3 tables computed from the clinical records (rma3-activity.ts,
// rma3-mother-child.ts). Pure. Conventions:
//  - ages at the date of the event (age-bands.ts rules);
//  - an event whose age or sex falls in no column still counts in the total;
//  - "persons" rows count each patient once (first event of the month), the other rows
//    count events.

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

export interface Person {
  birthDate: Date;
  gender: string | null;
}

export interface ActivityRow {
  code: string;
  label: string;
  cells: Record<string, number>;
  total: number;
}

export interface ActivityTable {
  section: string;
  title: string;
  columns: DisaggregationColumn[];
  rows: ActivityRow[];
  note?: string;
}

// The column of one event: a column key, "" for the total only.
export interface Breakdown<E> {
  columns: DisaggregationColumn[];
  keyOf: (e: E) => string;
}

export function ageSexBreakdown<E extends { person: Person; at: Date }>(bands: Parameters<typeof disaggregationColumns>[0]["bands"], bySex: boolean): Breakdown<E> {
  const config = { bands, bySex };
  return { columns: disaggregationColumns(config), keyOf: (e) => disaggregationKey(config, e.person, e.at) ?? "" };
}

// Sex only (newborns).
export const sexColumns: DisaggregationColumn[] = RMA3_SEXES.map((s) => ({ key: s.key, label: s.label }));

export interface Counted {
  id: string; // the patient for "persons" rows, the event otherwise
  at: Date;
  weight?: number; // e.g. hospital days; 1 by default
}

export function row<E extends Counted>(code: string, label: string, breakdown: Breakdown<E>, events: readonly E[], distinct: boolean): ActivityRow {
  const cells = emptyCells(breakdown.columns);
  const seen = new Set<string>();
  let total = 0;
  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (distinct) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
    }
    const weight = e.weight ?? 1;
    total += weight;
    const key = breakdown.keyOf(e);
    if (key && key in cells) cells[key] += weight;
  }
  return { code, label, cells, total };
}

// When a pregnancy stops counting as ongoing: delivery, end of a miscarriage /
// termination, or the expected due date when no end was recorded.
export interface PregnancyPeriod {
  lastMenstrualPeriod: Date;
  endedAt: Date;
}

export function isPregnantAt(pregnancies: readonly PregnancyPeriod[], at: Date): boolean {
  return pregnancies.some((p) => p.lastMenstrualPeriod <= at && at < p.endedAt);
}

export const inRange = (start: Date, end: Date) => (d: Date | null | undefined): d is Date =>
  Boolean(d) && d!.getTime() >= start.getTime() && d!.getTime() < end.getTime();
