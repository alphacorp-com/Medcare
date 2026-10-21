// ICD-10 code handling for the RMA3 cause rubrics (Rma3DiagnosisRubric.icd10Ranges).
// Pure functions, unit-tested in icd10-ranges.test.ts.
//
// A rubric lists codes and category ranges, comma-separated:
//   "B50-B54"        every code of categories B50 to B54 (B50, B50.9, … B54)
//   "A39, G00"       every code of category A39 and of category G00
//   "B65.0"          that sub-code and its children only (B65.0, B65.01…)
// Ranges are between 3-character categories, so sub-codes added to the catalog later
// are covered automatically.

const CODE_RE = /^[A-Z]\d{2}(\.\d{1,2})?$/;
const CATEGORY_RE = /^[A-Z]\d{2}$/;

export type Icd10Item = { kind: "code"; code: string } | { kind: "range"; from: string; to: string };

export type RangeParseResult =
  | { ok: true; items: Icd10Item[] }
  | { ok: false; error: "invalid_token" | "inverted_range" | "range_needs_categories"; token: string };

export function normalizeIcd10Code(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

const category = (code: string) => code.slice(0, 3);

export function parseIcd10Ranges(text: string): RangeParseResult {
  const items: Icd10Item[] = [];
  for (const raw of text.split(",")) {
    const token = raw.trim().toUpperCase();
    if (!token) continue;
    const parts = token.split("-").map((p) => p.trim());
    if (parts.length === 1) {
      if (!CODE_RE.test(parts[0])) return { ok: false, error: "invalid_token", token };
      items.push({ kind: "code", code: parts[0] });
    } else if (parts.length === 2) {
      const [from, to] = parts;
      if (!CODE_RE.test(from) || !CODE_RE.test(to)) return { ok: false, error: "invalid_token", token };
      if (!CATEGORY_RE.test(from) || !CATEGORY_RE.test(to)) return { ok: false, error: "range_needs_categories", token };
      if (from > to) return { ok: false, error: "inverted_range", token };
      items.push({ kind: "range", from, to });
    } else {
      return { ok: false, error: "invalid_token", token };
    }
  }
  return { ok: true, items };
}

// Canonical text of a parsed list, as stored ("B50-B54, A39").
export function formatIcd10Ranges(items: Icd10Item[]): string {
  return items.map((i) => (i.kind === "code" ? i.code : `${i.from}-${i.to}`)).join(", ");
}

export function codeMatchesItems(code: string, items: Icd10Item[]): boolean {
  const normalized = normalizeIcd10Code(code);
  if (!normalized) return false;
  const cat = category(normalized);
  return items.some((item) => {
    if (item.kind === "range") return cat >= item.from && cat <= item.to;
    // A category matches all its sub-codes; a sub-code matches itself and its children.
    return CATEGORY_RE.test(item.code) ? cat === item.code : normalized.startsWith(item.code);
  });
}

export interface RubricLike {
  code: string;
  label: string;
  icd10Ranges: string;
  order: number;
  isActive: boolean;
}

// Rubric a code is counted in: the first active rubric (by order) whose ranges match.
// Each diagnosis is counted once per RMA3 table, never in two rubrics.
export function findRubricForCode<T extends RubricLike>(code: string, rubrics: readonly T[]): T | null {
  const sorted = [...rubrics].filter((r) => r.isActive).sort((a, b) => a.order - b.order);
  for (const rubric of sorted) {
    const parsed = parseIcd10Ranges(rubric.icd10Ranges);
    if (parsed.ok && codeMatchesItems(code, parsed.items)) return rubric;
  }
  return null;
}

// Categories claimed by more than one active rubric of the same table: only the first
// (by order) counts them, so the administrator should know.
export function findOverlaps(rubrics: readonly RubricLike[]): Array<{ category: string; rubrics: string[] }> {
  const active = rubrics.filter((r) => r.isActive);
  const parsed = active.map((r) => ({ r, p: parseIcd10Ranges(r.icd10Ranges) }));
  const overlaps: Array<{ category: string; rubrics: string[] }> = [];
  for (let letter = 65; letter <= 90; letter++) {
    for (let n = 0; n <= 99; n++) {
      const cat = `${String.fromCharCode(letter)}${String(n).padStart(2, "0")}`;
      const claimants = parsed
        .filter(({ p }) => p.ok && p.items.some((item) => (item.kind === "range" ? cat >= item.from && cat <= item.to : category(item.code) === cat)))
        .map(({ r }) => r.code);
      if (claimants.length > 1) overlaps.push({ category: cat, rubrics: claimants });
    }
  }
  return overlaps;
}
