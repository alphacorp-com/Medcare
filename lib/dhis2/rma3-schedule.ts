// Which validated RMA3 months the automatic send still owes DHIS2. Pure, unit-tested in
// rma3-schedule.test.ts.
//
// A month is owed when its monthly form is validated and no real (non-simulated) send has
// SUCCEEDED since that validation. Reopening a month and validating it again moves its validation
// date, so the corrected month is sent again. A failed attempt (including a partial import) is
// retried, but not before RETRY_AFTER_MS: a daily run retries every day, a more frequent one does
// not hammer DHIS2, and a lasting misconfiguration writes one line a day in the history.

export interface ValidatedPeriod {
  period: string;
  validatedAt: Date;
}

// The last real send attempt of a month.
export interface SendAttempt {
  at: Date;
  ok: boolean;
}

// A failed send is retried once it is at least this old (a daily run therefore retries it daily).
export const RETRY_AFTER_MS = 12 * 60 * 60 * 1000;

// Months validated longer ago than this are left to a manual send.
export const AUTO_SEND_WINDOW_DAYS = 62;
// Upper bound per facility and per run (each send recomputes a month of registers).
export const AUTO_SEND_MAX_PERIODS = 3;

export function periodsToSend(
  validated: readonly ValidatedPeriod[],
  lastAttempt: ReadonlyMap<string, SendAttempt>,
  now: Date,
  { windowDays = AUTO_SEND_WINDOW_DAYS, max = AUTO_SEND_MAX_PERIODS }: { windowDays?: number; max?: number } = {}
): string[] {
  const oldest = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return validated
    .filter((v) => v.validatedAt.getTime() >= oldest)
    .filter((v) => {
      const last = lastAttempt.get(v.period);
      if (!last || last.at.getTime() < v.validatedAt.getTime()) return true; // never sent since validation
      return !last.ok && now.getTime() - last.at.getTime() >= RETRY_AFTER_MS; // failed: retry later
    })
    .map((v) => v.period)
    .sort()
    .slice(0, max);
}
