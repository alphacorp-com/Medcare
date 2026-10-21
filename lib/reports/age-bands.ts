// RMA3 age groups, computed at the date of the event (consultation, discharge, death),
// not at the report date. Pure, unit-tested in age-bands.test.ts.

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

export type CauseAgeBand = "age0to59m" | "age5to14" | "age15plus";

// "0-59 mois / 5-14 ans / 15 ans et +" — the breakdown of the RMA3 cause tables (V.1, V.3-V.5).
export function causeAgeBand(birthDate: Date, at: Date): CauseAgeBand {
  const months = ageInCompletedMonths(birthDate, at);
  if (months < 60) return "age0to59m";
  if (months < 180) return "age5to14";
  return "age15plus";
}
