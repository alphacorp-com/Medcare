// Which validated RMA3 months the automatic send still owes DHIS2. Pure, unit-tested in
// rma3-schedule.test.ts.
//
// A month is owed when its monthly form is validated and no real (non-simulated) send has been
// attempted since that validation. Reopening a month and validating it again moves its
// validation date, so the corrected month is sent again. A failed attempt counts as an attempt:
// the next run (the next day) retries it, so a lasting misconfiguration writes one line a day in
// the history, not one per call.

export interface ValidatedPeriod {
  period: string;
  validatedAt: Date;
}

// Months validated longer ago than this are left to a manual send.
export const AUTO_SEND_WINDOW_DAYS = 62;
// Upper bound per facility and per run (each send recomputes a month of registers).
export const AUTO_SEND_MAX_PERIODS = 3;

export function periodsToSend(
  validated: readonly ValidatedPeriod[],
  lastAttemptAt: ReadonlyMap<string, Date>,
  now: Date,
  { windowDays = AUTO_SEND_WINDOW_DAYS, max = AUTO_SEND_MAX_PERIODS }: { windowDays?: number; max?: number } = {}
): string[] {
  const oldest = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return validated
    .filter((v) => v.validatedAt.getTime() >= oldest)
    .filter((v) => {
      const last = lastAttemptAt.get(v.period);
      return !last || last.getTime() < v.validatedAt.getTime();
    })
    .map((v) => v.period)
    .sort()
    .slice(0, max);
}
