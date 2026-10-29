import Papa from "papaparse";
import type { Rma3IndicatorValue } from "./rma3-values";
import { normalizeIndicatorCode } from "./rma3-values";

// RMA3 → DHIS2: from the flat values and the facility's mapping to a DHIS2 `dataValueSets`
// payload, a file the district can import, and the mapping CSV. Pure, unit-tested in
// rma3-export.test.ts. No network and no database here: the same builders serve the file
// download and the API push, so what the facility downloads is exactly what would be sent.

export const DHIS2_UID = /^[A-Za-z][A-Za-z0-9]{10}$/;

export interface Rma3Mapping {
  indicatorCode: string;
  tableKey: string;
  cellKey: string;
  dataElementId: string;
  categoryOptionComboId: string | null;
}

export interface DhisDataValue {
  dataElement: string;
  categoryOptionCombo?: string;
  value: string;
}

const keyOf = (indicatorCode: string, tableKey: string, cellKey: string) => `${indicatorCode}\u0000${tableKey}\u0000${cellKey}`;

export function buildDataValues(values: readonly Rma3IndicatorValue[], mappings: readonly Rma3Mapping[]) {
  const byKey = new Map(mappings.map((m) => [keyOf(m.indicatorCode, m.tableKey, m.cellKey), m]));
  const dataValues: DhisDataValue[] = [];
  const unmapped: Rma3IndicatorValue[] = [];
  // DHIS2 stores one value per (data element, category option combo): two RMA3 cells mapped to the
  // same target would silently overwrite each other, so the second one is reported, not sent.
  const targets = new Map<string, Rma3IndicatorValue>();
  const collisions: { first: Rma3IndicatorValue; second: Rma3IndicatorValue }[] = [];

  for (const v of values) {
    const mapping = byKey.get(keyOf(v.indicatorCode, v.tableKey, v.cellKey));
    if (!mapping) {
      unmapped.push(v);
      continue;
    }
    const target = `${mapping.dataElementId}\u0000${mapping.categoryOptionComboId ?? ""}`;
    const previous = targets.get(target);
    if (previous) {
      collisions.push({ first: previous, second: v });
      continue;
    }
    targets.set(target, v);
    dataValues.push({
      dataElement: mapping.dataElementId,
      ...(mapping.categoryOptionComboId ? { categoryOptionCombo: mapping.categoryOptionComboId } : {}),
      value: String(v.value),
    });
  }
  return { dataValues, unmapped, collisions };
}

// DHIS2 monthly period: "202610".
export const isMonthlyPeriod = (period: string) => /^\d{4}(0[1-9]|1[0-2])$/.test(period);

export function buildDataValueSet(params: { dataSetId: string; orgUnitId: string; period: string; dataValues: DhisDataValue[] }) {
  return { dataSet: params.dataSetId, orgUnit: params.orgUnitId, period: params.period, dataValues: params.dataValues };
}

// DHIS2's CSV import format (header line included): dataelement, period, orgunit,
// categoryoptioncombo, attributeoptioncombo, value. The attribute option combo stays empty
// (the default one).
export function dataValuesToCsv(params: { orgUnitId: string; period: string; dataValues: DhisDataValue[] }): string {
  return Papa.unparse(
    {
      fields: ["dataelement", "period", "orgunit", "categoryoptioncombo", "attributeoptioncombo", "value"],
      data: params.dataValues.map((v) => [v.dataElement, params.period, params.orgUnitId, v.categoryOptionCombo ?? "", "", v.value]),
    },
    { newline: "\r\n" }
  );
}

// DHIS2 refuses very large bodies on some servers: send by chunks.
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ── Mapping CSV ─────────────────────────────────────────────────────────────

export const MAPPING_CSV_FIELDS = ["indicator_code", "table_key", "cell_key", "indicator_label", "cell_label", "data_element_id", "category_option_combo_id"] as const;

// The file to fill in: one line per (indicator, cell) the report produces, already filled where a
// mapping exists. It is built from the report itself, so it lists exactly what can be exported.
export function mappingTemplateCsv(values: readonly Rma3IndicatorValue[], mappings: readonly Rma3Mapping[]): string {
  const byKey = new Map(mappings.map((m) => [keyOf(m.indicatorCode, m.tableKey, m.cellKey), m]));
  return Papa.unparse(
    {
      fields: [...MAPPING_CSV_FIELDS],
      data: values.map((v) => {
        const m = byKey.get(keyOf(v.indicatorCode, v.tableKey, v.cellKey));
        return [v.indicatorCode, v.tableKey, v.cellKey, v.label, v.cellLabel, m?.dataElementId ?? "", m?.categoryOptionComboId ?? ""];
      }),
    },
    { newline: "\r\n" }
  );
}

export interface MappingCsvError {
  line: number;
  message: string;
}

// Reads a filled mapping CSV. Lines whose data element is empty are skipped (not mapped yet),
// every other line is checked: DHIS2 UID shapes, a known (indicator, cell). Nothing is trusted
// from the file but the four mapping columns.
export function parseMappingCsv(
  text: string,
  known: readonly Pick<Rma3IndicatorValue, "indicatorCode" | "tableKey" | "cellKey">[]
): { mappings: Rma3Mapping[]; errors: MappingCsvError[]; skipped: number } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const knownKeys = new Set(known.map((k) => keyOf(k.indicatorCode, k.tableKey, k.cellKey)));
  const mappings: Rma3Mapping[] = [];
  const errors: MappingCsvError[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  const columns = parsed.meta.fields ?? [];
  for (const required of ["indicator_code", "table_key", "data_element_id"]) {
    if (!columns.includes(required)) return { mappings, errors: [{ line: 1, message: `missing_column:${required}` }], skipped };
  }

  parsed.data.forEach((row, index) => {
    const line = index + 2; // header is line 1
    const dataElementId = (row.data_element_id ?? "").trim();
    if (!dataElementId) {
      skipped += 1;
      return;
    }
    const indicatorCode = normalizeIndicatorCode((row.indicator_code ?? "").trim());
    const tableKey = (row.table_key ?? "").trim();
    const cellKey = (row.cell_key ?? "").trim();
    const coc = (row.category_option_combo_id ?? "").trim();
    const key = keyOf(indicatorCode, tableKey, cellKey);
    const problem = !DHIS2_UID.test(dataElementId)
      ? "invalid_data_element_id"
      : coc && !DHIS2_UID.test(coc)
        ? "invalid_category_option_combo_id"
        : !knownKeys.has(key)
          ? "unknown_indicator_or_cell"
          : seen.has(key)
            ? "duplicate_line"
            : null;
    if (problem) {
      errors.push({ line, message: problem });
      return;
    }
    seen.add(key);
    mappings.push({ indicatorCode, tableKey, cellKey, dataElementId, categoryOptionComboId: coc || null });
  });
  return { mappings, errors, skipped };
}

// ── Coverage ────────────────────────────────────────────────────────────────

export function mappingCoverage(values: readonly Rma3IndicatorValue[], mappings: readonly Rma3Mapping[]) {
  const mapped = new Set(mappings.map((m) => keyOf(m.indicatorCode, m.tableKey, m.cellKey)));
  const indicators = new Map<string, { total: number; mapped: number }>(); // by code + table
  let mappedCells = 0;
  for (const v of values) {
    const indicatorKey = keyOf(v.indicatorCode, v.tableKey, "");
    const entry = indicators.get(indicatorKey) ?? { total: 0, mapped: 0 };
    entry.total += 1;
    if (mapped.has(keyOf(v.indicatorCode, v.tableKey, v.cellKey))) {
      entry.mapped += 1;
      mappedCells += 1;
    }
    indicators.set(indicatorKey, entry);
  }
  return {
    cells: values.length,
    mappedCells,
    indicators: indicators.size,
    fullyMappedIndicators: [...indicators.values()].filter((e) => e.mapped === e.total).length,
  };
}
