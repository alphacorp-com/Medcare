import { schemeColumns, type IndicatorRow } from "@/lib/hiv/rma3-hiv";

// CSV of indicator tables (one block per section, the section's columns as header), for
// Excel in French: ";" separator, UTF-8 BOM, quoted text. Pure, unit-tested.

export interface CsvSection {
  title: string;
  rows: readonly IndicatorRow[];
}

const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;

export function indicatorsToCsv(sections: readonly CsvSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (section.rows.length === 0) continue;
    const columns = schemeColumns(section.rows[0].scheme);
    lines.push(quote(section.title));
    lines.push(["Code", "Indicateur", ...columns.map((c) => c.label), "Total"].map(quote).join(";"));
    for (const row of section.rows) {
      lines.push([quote(row.code), quote(row.label), ...columns.map((c) => String(row.cells[c.key] ?? 0)), String(row.total)].join(";"));
    }
    lines.push("");
  }
  return "\uFEFF" + lines.join("\r\n");
}
