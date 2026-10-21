// RMA3 age and sex disaggregation, shared by every report section. Pure, unit-tested in
// age-bands.test.ts.
//
// Rules (identical everywhere):
//  - Age is the CALENDAR age in completed months/years at the date of the event
//    (consultation, administration, diagnosis, notification…), never at the report date and
//    never a day count divided by 365 (which shifts children across a band on leap years).
//  - Bands are half-open on the month scale: a child is "0-11 mois" until the day before
//    their first birthday, "5-14 ans" from their 5th birthday to the day before their 15th.
//  - Sex follows the RMA3 columns M / F; an unrecorded sex (U) is counted in totals only.

// Completed months between birth and `at` (calendar-based: a child born on the 31st turns
// one month old on the last day of the next month).
export function ageInCompletedMonths(birthDate: Date, at: Date): number {
  let months = (at.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (at.getUTCMonth() - birthDate.getUTCMonth());
  if (at.getUTCDate() < birthDate.getUTCDate()) {
    const lastDayOfMonth = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0)).getUTCDate();
    if (at.getUTCDate() < lastDayOfMonth) months -= 1;
  }
  return Math.max(0, months);
}

export function ageInCompletedYears(birthDate: Date, at: Date): number {
  return Math.floor(ageInCompletedMonths(birthDate, at) / 12);
}

// ── Age band schemes ────────────────────────────────────────────────────────

export interface AgeBand<K extends string = string> {
  key: K;
  label: string;
  // Inclusive lower bound and exclusive upper bound, in completed months (null = open).
  fromMonths: number;
  toMonths: number | null;
}

export type AgeBandScheme<K extends string = string> = readonly AgeBand<K>[];

const months = (n: number) => n;
const years = (n: number) => n * 12;

function scheme<K extends string>(bands: [key: K, label: string, from: number, to: number | null][]): AgeBandScheme<K> {
  return bands.map(([key, label, fromMonths, toMonths]) => ({ key, label, fromMonths, toMonths }));
}

// The breakdowns named in the RMA3 dictionary ("Désagrégation" column). Schemes that do not
// start at birth (adolescents, mothers 10-14…) leave younger patients out: ageBand → null.
export const RMA3_AGE_SCHEMES = {
  // V.1, V.3-V.5 causes: 0-59 mois / 5-14 ans / 15 ans et +
  cause: scheme([
    ["age0to59m", "0-59 mois", 0, years(5)],
    ["age5to14", "5-14 ans", years(5), years(15)],
    ["age15plus", "15 ans et +", years(15), null],
  ]),
  // III.2 vaccination: 0-11 / 12-23 / 24-59 mois, then out of the target population
  vaccination: scheme([
    ["ageUnder12m", "0-11 mois", 0, months(12)],
    ["age12to23m", "12-23 mois", months(12), months(24)],
    ["age24to59m", "24-59 mois", months(24), years(5)],
    ["age5yPlus", "5 ans et +", years(5), null],
  ]),
  // IV.3 tuberculosis: 0-4 / 5-14 / 15 ans et +
  tuberculosis: scheme([
    ["age0to4", "0-4 ans", 0, years(5)],
    ["age5to14", "5-14 ans", years(5), years(15)],
    ["age15Plus", "15 ans et +", years(15), null],
  ]),
  // IV.2 malaria, IV.4 asthma: < 5 ans / 5 ans et + (malaria adds pregnant women, see below)
  under5: scheme([
    ["under5", "< 5 ans", 0, years(5)],
    ["over5", "5 ans et +", years(5), null],
  ]),
  // III.7 PCIMNE: children 0-59 months only
  child0to59m: scheme([["age0to59m", "0-59 mois", 0, years(5)]]),
  // II.1 maternal health (CPN, delivery, post-natal): 10-14 / 15-19 / > 19 ans
  mother: scheme([
    ["age10to14", "10-14 ans", years(10), years(15)],
    ["age15to19", "15-19 ans", years(15), years(20)],
    ["age20plus", "> 19 ans", years(20), null],
  ]),
  // II.3.1 PTME: < 15 / 15-19 / 20-24 / 25 ans et +
  ptme: scheme([
    ["under15", "< 15 ans", 0, years(15)],
    ["age15to19", "15-19 ans", years(15), years(20)],
    ["age20to24", "20-24 ans", years(20), years(25)],
    ["age25plus", "25 ans et +", years(25), null],
  ]),
  // III.8 adolescent health: 10-14 / 15-19 / 20-24 ans
  adolescent: scheme([
    ["age10to14", "10-14 ans", years(10), years(15)],
    ["age15to19", "15-19 ans", years(15), years(20)],
    ["age20to24", "20-24 ans", years(20), years(25)],
  ]),
  // IV.4.9 mental health: 0-10 / 11-20 / 21-55 / > 55 ans
  mentalHealth: scheme([
    ["age0to10", "0-10 ans", 0, years(11)],
    ["age11to20", "11-20 ans", years(11), years(21)],
    ["age21to55", "21-55 ans", years(21), years(56)],
    ["age56plus", "> 55 ans", years(56), null],
  ]),
  // IV.4.10 eye, IV.4.11 oral/ENT: 0-14 / 15-49 / 50 ans et +
  eyeOral: scheme([
    ["age0to14", "0-14 ans", 0, years(15)],
    ["age15to49", "15-49 ans", years(15), years(50)],
    ["age50plus", "50 ans et +", years(50), null],
  ]),
  // IV.4.1 diabetes: "0-21 / 21+ ans" in the dictionary — read as < 21 / 21 ans et +.
  diabetes: scheme([
    ["under21", "< 21 ans", 0, years(21)],
    ["age21plus", "21 ans et +", years(21), null],
  ]),
  // IV.4.4 hypertension: < 40 / 40 ans et +
  hypertension: scheme([
    ["under40", "< 40 ans", 0, years(40)],
    ["age40plus", "40 ans et +", years(40), null],
  ]),
  // III.3 HPV: girls and boys of 9 years, and of 10-13 years
  hpv: scheme([
    ["age9", "9 ans", years(9), years(10)],
    ["age10to13", "10-13 ans", years(10), years(14)],
  ]),
  // IV.6 nutrition (CNTI): < 6 / 6-59 / > 59 mois (CNA uses the last two bands)
  nutrition: scheme([
    ["under6m", "< 6 mois", 0, months(6)],
    ["age6to59m", "6-59 mois", months(6), years(5)],
    ["age60mPlus", "> 59 mois", years(5), null],
  ]),
} as const;

// NOT DEFINED HERE ON PURPOSE: the "9 tranches" (IV.1.3 hepatitis/STI) and "13 tranches"
// (IV.1 HIV) breakdowns. The RMA3 dictionary names them without listing the bands; add them
// to RMA3_AGE_SCHEMES from the official form when the HIV / hepatitis modules are built.

export type Rma3AgeSchemeName = keyof typeof RMA3_AGE_SCHEMES;

// The band the patient falls in at `at`, or null when the scheme does not cover that age.
export function ageBand<K extends string>(bands: AgeBandScheme<K>, birthDate: Date, at: Date): K | null {
  const age = ageInCompletedMonths(birthDate, at);
  return bands.find((b) => age >= b.fromMonths && (b.toMonths === null || age < b.toMonths))?.key ?? null;
}

// "0-59 mois / 5-14 ans / 15 ans et +" — the breakdown of the RMA3 cause tables (V.1, V.3-V.5).
export type CauseAgeBand = (typeof RMA3_AGE_SCHEMES.cause)[number]["key"];
export function causeAgeBand(birthDate: Date, at: Date): CauseAgeBand {
  // The scheme is open-ended from birth, so every age has a band.
  return ageBand(RMA3_AGE_SCHEMES.cause, birthDate, at)!;
}

// ── Sex and pregnancy ───────────────────────────────────────────────────────

export type Rma3Sex = "M" | "F";
export const RMA3_SEXES: readonly { key: Rma3Sex; label: string }[] = [
  { key: "M", label: "M" },
  { key: "F", label: "F" },
];

// Patient.gender (M / F / U) → RMA3 sex column, null when not recorded.
export function rma3Sex(gender: string | null | undefined): Rma3Sex | null {
  return gender === "M" || gender === "F" ? gender : null;
}

// Sections such as malaria report pregnant women as their own column instead of their age
// band ("< 5 ans / 5 ans et + / Femmes enceintes").
export const PREGNANT = "pregnant" as const;
export function bandOrPregnant<K extends string>(band: K | null, isPregnant: boolean): K | typeof PREGNANT | null {
  return isPregnant ? PREGNANT : band;
}

// ── Columns: age band × sex ─────────────────────────────────────────────────

export interface DisaggregationColumn {
  key: string;
  label: string;
}

export interface Disaggregation {
  bands: AgeBandScheme | null;
  bySex: boolean;
}

// The report columns of a breakdown, in form order: bands, sexes, or band × sex.
export function disaggregationColumns({ bands, bySex }: Disaggregation): DisaggregationColumn[] {
  if (bands && bySex) return bands.flatMap((b) => RMA3_SEXES.map((s) => ({ key: `${b.key}_${s.key}`, label: `${b.label} ${s.label}` })));
  if (bands) return bands.map((b) => ({ key: b.key, label: b.label }));
  if (bySex) return RMA3_SEXES.map((s) => ({ key: s.key, label: s.label }));
  return [];
}

// The column one event falls in:
//  - a column key;
//  - "" when it belongs in the total but in no column (sex not recorded, or no breakdown);
//  - null when the breakdown's age bands exclude the patient (count it nowhere).
export function disaggregationKey(
  { bands, bySex }: Disaggregation,
  patient: { birthDate: Date; gender: string | null | undefined },
  at: Date
): string | null {
  const band = bands ? ageBand(bands, patient.birthDate, at) : null;
  if (bands && band === null) return null;
  const sex = bySex ? rma3Sex(patient.gender) : null;
  if (bySex && !sex) return "";
  if (band && sex) return `${band}_${sex}`;
  return band ?? sex ?? "";
}

// Zeroed counters for the given columns.
export function emptyCells(columns: readonly DisaggregationColumn[]): Record<string, number> {
  return Object.fromEntries(columns.map((c) => [c.key, 0]));
}
