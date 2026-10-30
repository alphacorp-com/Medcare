// Likely duplicates of a patient being created. The pure part (normalisation, matching rules)
// is unit-tested in duplicates.test.ts; findDuplicateCandidates does the database lookup.
//
// A record is a likely duplicate when:
//   - it has the same NSS; or
//   - it has the same birth date and the same name — compared without case, accents,
//     hyphens or extra spaces, first and last name possibly swapped, and one first name
//     possibly a prefix of the other ("Marie" / "Marie-Claire"); or
//   - it has the same phone number (last 9 digits, so +237 / 00237 / spaces do not matter)
//     and either the same birth date or the same last name.

export type DuplicateReason = "nss" | "name_birth_date" | "phone";

export interface DuplicateInput {
  firstName: string;
  lastName: string;
  birthDate: Date;
  nss?: string | null;
  phone?: string | null;
}

export interface DuplicateCandidate {
  id: string;
  ipp: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  nss: string | null;
  phone: string | null;
}

// "Marie-Claire  NGONO" → "marie claire ngono"
export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "+237 6 99 12 34 56" → "699123456" (last 9 digits: a Cameroonian number). Too short → "".
export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D+/g, "");
  return digits.length >= 8 ? digits.slice(-9) : "";
}

const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

// "marie" matches "marie claire" (word prefix), never "mari" inside "marius".
function firstNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return longer.startsWith(`${shorter} `);
}

function namesMatch(input: { firstName: string; lastName: string }, candidate: { firstName: string; lastName: string }): boolean {
  const [f1, l1, f2, l2] = [input.firstName, input.lastName, candidate.firstName, candidate.lastName].map(normalizeName);
  if (!l1 || !l2) return false;
  // Same order, or first and last names entered the other way round.
  return (l1 === l2 && firstNamesMatch(f1, f2)) || (l1 === f2 && firstNamesMatch(f1, l2));
}

export function duplicateReasons(input: DuplicateInput, candidate: DuplicateCandidate): DuplicateReason[] {
  const reasons: DuplicateReason[] = [];
  const nss = input.nss?.trim();
  if (nss && candidate.nss && candidate.nss.trim().toLowerCase() === nss.toLowerCase()) reasons.push("nss");
  if (sameDay(input.birthDate, candidate.birthDate) && namesMatch(input, candidate)) reasons.push("name_birth_date");
  const phone = normalizePhone(input.phone);
  if (phone && phone === normalizePhone(candidate.phone)) {
    const sameLastName = normalizeName(input.lastName) === normalizeName(candidate.lastName);
    if (sameDay(input.birthDate, candidate.birthDate) || sameLastName) reasons.push("phone");
  }
  return reasons;
}

export const MAX_DUPLICATE_MATCHES = 5;
