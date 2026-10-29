import type { Rma3Mapping } from "./rma3-export";
import { DHIS2_UID } from "./rma3-export";
import type { Rma3IndicatorValue } from "./rma3-values";

// Proposes the DHIS2 target of each RMA3 cell from the structure of the national data set (its
// data elements and their category option combos). Pure, unit-tested in rma3-mapping.test.ts.
//
// Deliberately cautious: only EXACT matches are proposed, and an administrator applies them. A
// wrong guess would silently send a figure into the wrong DHIS2 cell, which is worse than a cell
// left to the CSV.
// Cells are told apart by (code, table, cell): a code reused by two tables is proposed per table
// only when the data element is unique, so the same element can never be proposed twice.
//   - data element: the indicator code (with or without "RMA3-") appears in the element's `code`,
//     `shortName` or `name`, and in exactly one element;
//   - category option combo: a single (default) combo needs none; otherwise the combo's `code`
//     equals the cell key, or its name carries the same words as the cell label.

export interface Dhis2Combo {
  id: string;
  name: string;
  code?: string | null;
}

export interface Dhis2DataElementStructure {
  id: string;
  name: string;
  shortName?: string | null;
  code?: string | null;
  combos: Dhis2Combo[];
}

export interface MappingProposal extends Rma3Mapping {
  elementName: string;
  comboName: string | null;
}

export interface MappingProposals {
  proposals: MappingProposal[];
  // Why a cell got no proposal.
  noElement: number;
  ambiguousElement: number;
  noCombo: number;
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = (s: string) =>
  stripAccents(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0)
    .sort()
    .join(" ");

// The code, as a whole token: not glued to a longer code on either side.
export function containsCode(haystack: string | null | undefined, code: string): boolean {
  if (!haystack) return false;
  const bare = code.replace(/^RMA3-/, "");
  const escaped = bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9.-])(?:RMA3-)?${escaped}(?![0-9A-Za-z])`, "i").test(haystack);
}

function isDefaultCombo(combos: readonly Dhis2Combo[]): boolean {
  return combos.length === 0 || (combos.length === 1 && /^default$/i.test(combos[0].name.trim()));
}

export function proposeMappings(
  values: readonly Pick<Rma3IndicatorValue, "indicatorCode" | "tableKey" | "cellKey" | "cellLabel">[],
  elements: readonly Dhis2DataElementStructure[],
  alreadyMapped: readonly Pick<Rma3Mapping, "indicatorCode" | "tableKey" | "cellKey">[] = []
): MappingProposals {
  const done = new Set(alreadyMapped.map((m) => `${m.indicatorCode}\u0000${m.tableKey}\u0000${m.cellKey}`));
  const elementOf = new Map<string, Dhis2DataElementStructure | "ambiguous" | null>();
  const result: MappingProposals = { proposals: [], noElement: 0, ambiguousElement: 0, noCombo: 0 };

  const findElement = (code: string) => {
    if (elementOf.has(code)) return elementOf.get(code)!;
    const hits = elements.filter((e) => containsCode(e.code, code) || containsCode(e.shortName, code) || containsCode(e.name, code));
    const found = hits.length === 1 ? hits[0] : hits.length > 1 ? ("ambiguous" as const) : null;
    elementOf.set(code, found);
    return found;
  };

  for (const v of values) {
    if (done.has(`${v.indicatorCode}\u0000${v.tableKey}\u0000${v.cellKey}`)) continue;
    const element = findElement(v.indicatorCode);
    if (element === null) {
      result.noElement += 1;
      continue;
    }
    if (element === "ambiguous") {
      result.ambiguousElement += 1;
      continue;
    }
    if (!DHIS2_UID.test(element.id)) {
      result.noElement += 1;
      continue;
    }

    if (isDefaultCombo(element.combos)) {
      // A breakdown-less element only takes the indicator's single cell.
      if (v.cellKey === "") result.proposals.push({ indicatorCode: v.indicatorCode, tableKey: v.tableKey, cellKey: "", dataElementId: element.id, categoryOptionComboId: null, elementName: element.name, comboName: null });
      else result.noCombo += 1;
      continue;
    }

    const wanted = v.cellLabel ? words(v.cellLabel) : "";
    const combo =
      element.combos.find((c) => c.code && c.code === v.cellKey) ??
      (wanted ? element.combos.find((c) => words(c.name) === wanted) : undefined);
    if (combo && DHIS2_UID.test(combo.id)) {
      result.proposals.push({ indicatorCode: v.indicatorCode, tableKey: v.tableKey, cellKey: v.cellKey, dataElementId: element.id, categoryOptionComboId: combo.id, elementName: element.name, comboName: combo.name });
    } else {
      result.noCombo += 1;
    }
  }
  return result;
}
