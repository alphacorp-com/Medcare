import dictionary from "./rma3-dictionary.json";
import { normalizeIndicatorCode } from "./rma3-values";

// The 955 indicators of the RMA3 dictionary (Dictionnaire_Indicateurs_RMA3_Medcare.xlsx), kept as
// JSON because the workbook is not versioned. Used to tell what the report does not produce yet.
// A few codes are reused by two sections (IV.4-001, VI.3-001…), so a code can have several entries.

export interface Rma3DictionaryEntry {
  code: string;
  section: string;
  subdomain: string;
  label: string;
  disaggregation: string;
}

export const RMA3_DICTIONARY: readonly Rma3DictionaryEntry[] = dictionary;

// Which dictionary indicators the report produced a value for, and by section the ones it did not.
export function dictionaryCoverage(producedCodes: Iterable<string>) {
  const produced = new Set([...producedCodes].map(normalizeIndicatorCode));
  const missingBySection = new Map<string, number>();
  let producedCount = 0;
  for (const entry of RMA3_DICTIONARY) {
    if (produced.has(entry.code)) {
      producedCount += 1;
      continue;
    }
    // "RMA3-IV.2-004" → "IV.2"
    const group = /^RMA3-([IVX]+\.[0-9]+)/.exec(entry.code)?.[1] ?? "I";
    missingBySection.set(group, (missingBySection.get(group) ?? 0) + 1);
  }
  return {
    total: RMA3_DICTIONARY.length,
    produced: producedCount,
    notProduced: RMA3_DICTIONARY.length - producedCount,
    notProducedBySection: [...missingBySection.entries()].sort((a, b) => b[1] - a[1]).map(([section, count]) => ({ section, count })),
  };
}
