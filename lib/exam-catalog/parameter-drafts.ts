import type { ExamParameterDefinition, SexReference } from "@/lib/exam-catalog/parameters";

// Editing model of one result-sheet row in Settings → Exam types. Numbers stay as typed
// text while editing ("4,5" is valid), and the row's kind is explicit — the stored
// definition only implies it. Pure conversions, unit-tested in parameter-drafts.test.ts.

export type ParameterKind = "numeric" | "qualitative" | "text";
export type OptionFlag = "normal" | "abnormal" | "critical";

export interface SexDraft {
  referenceRange: string;
  low: string;
  high: string;
}

export interface ParameterDraft {
  // Stable React key — not stored.
  key: string;
  kind: ParameterKind;
  section: string;
  name: string;
  unit: string;
  referenceRange: string;
  low: string;
  high: string;
  criticalLow: string;
  criticalHigh: string;
  bySexEnabled: boolean;
  male: SexDraft;
  female: SexDraft;
  // Qualitative answers with the flag each one yields.
  options: Array<{ value: string; flag: OptionFlag }>;
}

let keySeed = 0;
export const newDraftKey = () => `p${Date.now().toString(36)}${(keySeed++).toString(36)}`;

const emptySex = (): SexDraft => ({ referenceRange: "", low: "", high: "" });

export function blankDraft(kind: ParameterKind = "numeric", section = ""): ParameterDraft {
  return {
    key: newDraftKey(),
    kind,
    section,
    name: "",
    unit: "",
    referenceRange: "",
    low: "",
    high: "",
    criticalLow: "",
    criticalHigh: "",
    bySexEnabled: false,
    male: emptySex(),
    female: emptySex(),
    options: [],
  };
}

const numberText = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));

export function kindOfDefinition(def: ExamParameterDefinition): ParameterKind {
  if (def.options?.length) return "qualitative";
  const numeric = [def.low, def.high, def.criticalLow, def.criticalHigh].some((n) => n !== undefined);
  return numeric || def.bySex ? "numeric" : "text";
}

function sexDraft(ref: SexReference | undefined): SexDraft {
  return ref ? { referenceRange: ref.referenceRange, low: numberText(ref.low), high: numberText(ref.high) } : emptySex();
}

export function toDraft(def: ExamParameterDefinition): ParameterDraft {
  const normal = new Set(def.normalOptions ?? []);
  const critical = new Set(def.criticalOptions ?? []);
  return {
    key: newDraftKey(),
    kind: kindOfDefinition(def),
    section: def.section ?? "",
    name: def.name,
    unit: def.unit ?? "",
    referenceRange: def.referenceRange ?? "",
    low: numberText(def.low),
    high: numberText(def.high),
    criticalLow: numberText(def.criticalLow),
    criticalHigh: numberText(def.criticalHigh),
    bySexEnabled: Boolean(def.bySex),
    male: sexDraft(def.bySex?.M),
    female: sexDraft(def.bySex?.F),
    options: (def.options ?? []).map((value) => ({
      value,
      flag: critical.has(value) ? "critical" : normal.has(value) ? "normal" : "abnormal",
    })),
  };
}

// "4,5" and "4.5" both parse. Anything else becomes NaN, which validateExamParameters
// rejects — it must never silently turn into "no bound" (JSON would serialize NaN as null).
export function parseDecimal(value: string): number | undefined {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return undefined;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

function sexReference(draft: SexDraft): SexReference | undefined {
  const low = parseDecimal(draft.low);
  const high = parseDecimal(draft.high);
  if (!draft.referenceRange.trim() && low === undefined && high === undefined) return undefined;
  return {
    referenceRange: draft.referenceRange.trim(),
    ...(low !== undefined ? { low } : {}),
    ...(high !== undefined ? { high } : {}),
  };
}

// Only the fields of the row's kind are kept, so switching kind can't leave hidden
// bounds behind. The result is then checked by validateExamParameters.
export function fromDraft(draft: ParameterDraft): ExamParameterDefinition {
  const base: ExamParameterDefinition = {
    ...(draft.section.trim() ? { section: draft.section.trim() } : {}),
    name: draft.name.trim(),
    unit: draft.kind === "qualitative" ? "" : draft.unit.trim(),
    referenceRange: draft.referenceRange.trim(),
  };

  if (draft.kind === "qualitative") {
    const options = draft.options.map((o) => ({ ...o, value: o.value.trim() })).filter((o) => o.value);
    const normalOptions = options.filter((o) => o.flag === "normal").map((o) => o.value);
    const criticalOptions = options.filter((o) => o.flag === "critical").map((o) => o.value);
    return {
      ...base,
      options: options.map((o) => o.value),
      ...(normalOptions.length ? { normalOptions } : {}),
      ...(criticalOptions.length ? { criticalOptions } : {}),
    };
  }

  if (draft.kind === "text") return base;

  const low = parseDecimal(draft.low);
  const high = parseDecimal(draft.high);
  const criticalLow = parseDecimal(draft.criticalLow);
  const criticalHigh = parseDecimal(draft.criticalHigh);
  const M = draft.bySexEnabled ? sexReference(draft.male) : undefined;
  const F = draft.bySexEnabled ? sexReference(draft.female) : undefined;
  return {
    ...base,
    ...(low !== undefined ? { low } : {}),
    ...(high !== undefined ? { high } : {}),
    ...(criticalLow !== undefined ? { criticalLow } : {}),
    ...(criticalHigh !== undefined ? { criticalHigh } : {}),
    ...(M || F ? { bySex: { ...(M ? { M } : {}), ...(F ? { F } : {}) } } : {}),
  };
}

export const draftsFromDefinitions = (defs: readonly ExamParameterDefinition[]) => defs.map(toDraft);
export const definitionsFromDrafts = (drafts: readonly ParameterDraft[]) => drafts.map(fromDraft);

export function moveDraft(drafts: readonly ParameterDraft[], index: number, offset: -1 | 1): ParameterDraft[] {
  const target = index + offset;
  if (target < 0 || target >= drafts.length) return [...drafts];
  const next = [...drafts];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function duplicateDraft(drafts: readonly ParameterDraft[], index: number): ParameterDraft[] {
  const source = drafts[index];
  const copy: ParameterDraft = {
    ...source,
    key: newDraftKey(),
    male: { ...source.male },
    female: { ...source.female },
    options: source.options.map((o) => ({ ...o })),
  };
  return [...drafts.slice(0, index + 1), copy, ...drafts.slice(index + 1)];
}
