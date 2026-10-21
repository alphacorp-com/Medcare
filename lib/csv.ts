// CSV building for client-side exports (RFC 4180 quoting, CRLF rows).
//
// Cells that a spreadsheet would read as a formula (=, +, -, @, tab, CR) are prefixed with
// an apostrophe: exported values include user-typed text (names, reasons), and a cell such
// as `=HYPERLINK(...)` must not execute when the file is opened in Excel/LibreOffice
// (CSV/formula injection, OWASP).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_TRIGGER.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

// Browser-only. The UTF-8 BOM makes Excel decode accented characters correctly.
export function downloadCsv(filename: string, rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): void {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
