import type { Rma3ReportData } from "@/lib/reports/rma3";

// The RMA3 report as one flat list of values — (indicator, breakdown cell, number) — the shape
// DHIS2 stores them in. Pure, unit-tested in rma3-values.test.ts.
//
// The report is organised in tables by section; every table that carries the RMA3 indicator
// code of its rows (activity, morbidity, causes of consultation / hospitalisation / death,
// HIV / PMTCT / hepatitis and the monthly form) is flattened here. The oldest sections —
// facility activity, maternal health, vaccination, malaria, tuberculosis, EPI, stock — are
// labelled by text, not by code, so they have no stable key to map to a DHIS2 data element yet:
// they are not exported (see ATTACHED_SECTIONS), and the coverage view says so.

// Identity of a value: (indicatorCode, tableKey, cellKey). The RMA3 reuses its codes — II.2-001 is
// a cervical screening in the activity table and a confirmed breast cancer in the morbidity one,
// and the two PCIMA tables (CNA, CNTI) share every code — so the code alone would merge distinct
// indicators. The table key is stable text built from the table's section and title.
export interface Rma3IndicatorValue {
  // The app's own code, always prefixed "RMA3-" (e.g. "RMA3-II.1.1-002").
  indicatorCode: string;
  // Where the row comes from: "activity:II.1.1:consultations-prenatales", "morbidity:II.2:…",
  // "causes:V.3", "hiv:hivTesting", "manual:VI.3-D".
  tableKey: string;
  // The breakdown column ("" for an indicator without breakdown). Deaths of a morbidity row use
  // "death" (total) and "death:<column>".
  cellKey: string;
  label: string;
  cellLabel: string;
  value: number;
  // "computed" from the registers, or "manual" (entered on the monthly form).
  origin: "computed" | "manual";
}

// Sections of Rma3ReportData flattened by this module.
export const ATTACHED_SECTIONS = ["activity", "morbidity", "causes", "hiv", "manual"] as const;

export function normalizeIndicatorCode(code: string): string {
  return code.startsWith("RMA3-") ? code : `RMA3-${code}`;
}

// "Consultations prénatales" → "consultations-prenatales" (accents dropped, 40 characters).
export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const tableKeyOf = (source: string, section: string, title?: string) => [source, section, title ? slug(title) : ""].filter(Boolean).join(":");

interface CodedRow {
  code: string;
  label: string;
  cells: Record<string, number | null>;
  total: number | null;
}

interface FlattenOptions {
  // Export the cells that count 0 too. A report that leaves a cell out says "not entered", not
  // "none": DHIS2 keeps explicit zeros where the data element accepts them and ignores the rest.
  includeZeros?: boolean;
}

function rowValues(
  tableKey: string,
  row: CodedRow,
  columns: readonly { key: string; label: string }[],
  origin: Rma3IndicatorValue["origin"],
  includeZeros: boolean
): Rma3IndicatorValue[] {
  const code = normalizeIndicatorCode(row.code);
  const labelOf = new Map(columns.map((c) => [c.key, c.label]));
  const out: Rma3IndicatorValue[] = [];
  const entries = Object.entries(row.cells);

  if (entries.length === 0) {
    // No breakdown: the total is the value (a manual row never entered has a null total).
    if (row.total !== null && (includeZeros || row.total !== 0 || origin === "manual")) {
      out.push({ indicatorCode: code, tableKey, cellKey: "", label: row.label, cellLabel: "", value: row.total, origin });
    }
    return out;
  }
  for (const [key, value] of entries) {
    if (value === null || value === undefined) continue; // not entered
    if (value === 0 && !includeZeros && origin === "computed") continue;
    out.push({ indicatorCode: code, tableKey, cellKey: key, label: row.label, cellLabel: labelOf.get(key) ?? key, value, origin });
  }
  return out;
}

export function flattenRma3Report(
  report: Pick<Rma3ReportData, "activity" | "morbidity" | "causes" | "hiv" | "manual">,
  { includeZeros = true }: FlattenOptions = {}
): { values: Rma3IndicatorValue[]; duplicates: { indicatorCode: string; cellKey: string }[] } {
  const all: Rma3IndicatorValue[] = [];

  // II.1.1-II.1.5, III.9, IV.2.1, IV.2.4-5, IV.3, IV.4.4, V.1.
  for (const table of report.activity) {
    const tableKey = tableKeyOf("activity", table.section, table.title);
    for (const row of table.rows) all.push(...rowValues(tableKey, row, table.columns, "computed", includeZeros));
  }

  // II.2, III.7, IV.4, IV.5: new cases per breakdown column, plus the deaths of the sections that have them.
  for (const table of report.morbidity) {
    const tableKey = tableKeyOf("morbidity", table.section, table.title);
    for (const row of table.rows) {
      all.push(...rowValues(tableKey, { ...row, cells: row.cells, total: row.total }, table.columns, "computed", includeZeros));
      const code = normalizeIndicatorCode(row.code);
      if (row.deathCells) {
        for (const [key, value] of Object.entries(row.deathCells)) {
          if (value === 0 && !includeZeros) continue;
          const label = table.columns.find((c) => c.key === key)?.label ?? key;
          all.push({ indicatorCode: code, tableKey, cellKey: `death:${key}`, label: row.label, cellLabel: `Décès ${label}`, value, origin: "computed" });
        }
      } else if (row.deaths !== null) {
        if (row.deaths !== 0 || includeZeros) {
          all.push({ indicatorCode: code, tableKey, cellKey: "death", label: row.label, cellLabel: "Décès", value: row.deaths, origin: "computed" });
        }
      }
    }
  }

  // V.3 / V.4 / V.5: causes by age band (the unclassified remainder has no code).
  const CAUSE_CELLS: [string, string, "age0to59m" | "age5to14" | "age15plus"][] = [
    ["age0to59m", "0-59 mois", "age0to59m"],
    ["age5to14", "5-14 ans", "age5to14"],
    ["age15plus", "15 ans et +", "age15plus"],
  ];
  for (const table of report.causes) {
    const tableKey = tableKeyOf("causes", table.section);
    for (const row of table.rows) {
      const code = normalizeIndicatorCode(row.code);
      for (const [key, cellLabel, field] of CAUSE_CELLS) {
        const value = row[field];
        if (value === 0 && !includeZeros) continue;
        all.push({ indicatorCode: code, tableKey, cellKey: key, label: row.label, cellLabel, value, origin: "computed" });
      }
    }
  }

  // IV.1 HIV / hepatitis / STI, II.3 PMTCT, II.1.1-016..023: rows with the same shape as the activity tables.
  const hivGroups = {
    hivTesting: report.hiv.hivTesting,
    artFollowUp: report.hiv.artFollowUp,
    pmtctAntenatal: report.hiv.pmtctAntenatal,
    antenatalScreening: report.hiv.antenatalScreening,
    pmtctMaternity: report.hiv.pmtctMaternity,
    pmtctReferrals: report.hiv.pmtctReferrals,
    pmtctViralLoad: report.hiv.pmtctViralLoad,
    pmtctPostnatal: report.hiv.pmtctPostnatal,
    hepatitisSti: report.hiv.hepatitisSti,
  };
  for (const [group, rows] of Object.entries(hivGroups)) {
    const tableKey = tableKeyOf("hiv", group);
    for (const row of rows) all.push(...rowValues(tableKey, row, [], "computed", includeZeros));
  }

  // The monthly form: only the cells actually entered.
  for (const section of report.manual.sections) {
    const tableKey = tableKeyOf("manual", section.code);
    for (const table of section.tables) {
      for (const row of table.rows) all.push(...rowValues(tableKey, { ...row, cells: row.cells }, table.columns, "manual", true));
    }
  }

  // One value per (indicator, table, cell). The same code in two tables is two indicators and is
  // kept; only a code repeated inside ONE table (a bug in the report) keeps its first value and
  // is reported.
  const seen = new Set<string>();
  const duplicates: { indicatorCode: string; tableKey: string; cellKey: string }[] = [];
  const values: Rma3IndicatorValue[] = [];
  for (const v of all) {
    const key = `${v.indicatorCode}\u0000${v.tableKey}\u0000${v.cellKey}`;
    if (seen.has(key)) {
      duplicates.push({ indicatorCode: v.indicatorCode, tableKey: v.tableKey, cellKey: v.cellKey });
      continue;
    }
    seen.add(key);
    values.push(v);
  }
  return { values, duplicates };
}
