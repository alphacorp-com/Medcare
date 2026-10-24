// Is a beneficiary covered on a given day? Pure — shared by the invoice computation
// (lib/coverage/apply.ts) and the default coverage of a new invoice.
//
// A beneficiary is covered when, on that day:
//   - their own line on the membership is valid (dates, not removed);
//   - the membership itself is valid (dates, not ended) — a dependant never outlives the holder's
//     membership;
//   - the convention and its payer are active and the convention is in force;
//   - a child dependant is younger than the convention's age limit.

const DAY = 86_400_000;

// UTC day of a timestamp: coverage dates are calendar days (@db.Date).
export const dayOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const within = (day: Date, from: Date | null, to: Date | null) => (!from || from.getTime() <= day.getTime()) && (!to || day.getTime() <= to.getTime());

// Whole years between a birth date and a day (birthdays counted on the day).
export function ageInYears(birthDate: Date, day: Date): number {
  let years = day.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday = day.getUTCMonth() < birthDate.getUTCMonth() || (day.getUTCMonth() === birthDate.getUTCMonth() && day.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

export interface BeneficiaryTerms {
  relationship: "holder" | "spouse" | "child" | "other";
  validFrom: Date;
  validTo: Date | null;
  endedAt: Date | null;
  policy: { validFrom: Date; validTo: Date | null; endedAt: Date | null };
  agreement: { isActive: boolean; validFrom: Date | null; validTo: Date | null; childMaxAgeYears: number | null; payerActive: boolean };
}

export type Validity = { valid: true } | { valid: false; reason: "beneficiary" | "membership" | "convention" | "age_limit" };

export function beneficiaryValidity(terms: BeneficiaryTerms, birthDate: Date, at: Date): Validity {
  const day = dayOf(at);
  const endedBefore = (endedAt: Date | null) => endedAt !== null && endedAt.getTime() <= at.getTime();
  if (endedBefore(terms.endedAt) || !within(day, terms.validFrom, terms.validTo)) return { valid: false, reason: "beneficiary" };
  if (endedBefore(terms.policy.endedAt) || !within(day, terms.policy.validFrom, terms.policy.validTo)) return { valid: false, reason: "membership" };
  const a = terms.agreement;
  if (!a.isActive || !a.payerActive || !within(day, a.validFrom, a.validTo)) return { valid: false, reason: "convention" };
  if (terms.relationship === "child" && a.childMaxAgeYears !== null && ageInYears(birthDate, day) >= a.childMaxAgeYears) return { valid: false, reason: "age_limit" };
  return { valid: true };
}

// Calendar year [start, end) of a timestamp: the period of the annual ceilings.
export function calendarYear(at: Date): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(at.getUTCFullYear(), 0, 1)), end: new Date(Date.UTC(at.getUTCFullYear() + 1, 0, 1)) };
}

export const MS_PER_DAY = DAY;
