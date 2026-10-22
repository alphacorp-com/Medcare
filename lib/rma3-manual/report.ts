import { BREAKDOWN_COLUMNS, RMA3_MANUAL_SECTIONS, type Rma3BreakdownColumn, type Rma3ValueKind } from "@/lib/rma3-manual/catalog";
import type { Rma3ManualValues } from "@/lib/rma3-manual/data";

// The RMA3 monthly form as report tables. Pure, unit-tested in report.test.ts. A cell never
// entered stays null (printed "—"), so a forgotten field is not mistaken for a zero.

export interface Rma3ManualReportRow {
  code: string;
  label: string;
  kind: Rma3ValueKind;
  cells: Record<string, number | null>;
  // Sum of the cells entered (null when none was); not computed for yes / no.
  total: number | null;
}

export interface Rma3ManualReportSection {
  code: string;
  title: string;
  // The section's indicators may mix breakdowns: one table per run of the same columns.
  tables: { columns: readonly Rma3BreakdownColumn[]; rows: Rma3ManualReportRow[] }[];
}

export interface Rma3ManualReport {
  status: "draft" | "validated";
  validatedAt: Date | null;
  sections: Rma3ManualReportSection[];
  // Cells entered / cells of the form, to show how complete the month is.
  filledCells: number;
  totalCells: number;
}

export function buildManualReport(values: Rma3ManualValues, status: "draft" | "validated", validatedAt: Date | null): Rma3ManualReport {
  let filledCells = 0;
  let totalCells = 0;
  const sections = RMA3_MANUAL_SECTIONS.map((section) => {
    const tables: Rma3ManualReportSection["tables"] = [];
    for (const indicator of section.indicators) {
      const columns = BREAKDOWN_COLUMNS[indicator.breakdown];
      const entered = values[indicator.code] ?? {};
      const cells: Record<string, number | null> = {};
      let total: number | null = null;
      for (const column of columns) {
        const value = entered[column.key];
        totalCells += 1;
        if (value === undefined) {
          cells[column.key] = null;
          continue;
        }
        filledCells += 1;
        cells[column.key] = value;
        total = (total ?? 0) + value;
      }
      const row = { code: indicator.code, label: indicator.label, kind: indicator.kind, cells, total: indicator.kind === "yesNo" ? null : total };
      const last = tables[tables.length - 1];
      if (last && last.columns === columns) last.rows.push(row);
      else tables.push({ columns, rows: [row] });
    }
    return { code: section.code, title: section.title, tables };
  });
  return { status, validatedAt, sections, filledCells, totalCells };
}

// How a cell is printed: "—" when not entered, Oui / Non, amounts with thousands separators.
export function formatManualValue(value: number | null, kind: Rma3ValueKind): string {
  if (value === null) return "—";
  if (kind === "yesNo") return value === 1 ? "Oui" : "Non";
  if (kind === "amount") return value.toLocaleString("fr-FR").replace(/ | /g, " ");
  return String(value);
}
