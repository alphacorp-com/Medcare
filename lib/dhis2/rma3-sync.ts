import prisma from "@/lib/prisma";
import { computeRma3Report } from "@/lib/reports/rma3";
import { submitDataValueSet, fetchDataSetStructure } from "./client";
import { decryptSecret } from "./crypto";
import { getDhis2Config } from "./config";
import { buildDataValues, buildDataValueSet, chunk, isMonthlyPeriod, mappingCoverage, type Rma3Mapping } from "./rma3-export";
import { proposeMappings } from "./rma3-mapping";
import { flattenRma3Report } from "./rma3-values";
import type { Dhis2Conflict, Dhis2ImportCount } from "./types";

// Server side of the RMA3 → DHIS2 export (file or API). The report is recomputed from the
// registers on every call, scoped to the facility of the session: nothing the browser sends
// decides which figures are exported.

// DHIS2 accepts large payloads, but some servers cap the body: send by chunks.
const PUSH_CHUNK_SIZE = 1000;
const MAX_REPORTED_CONFLICTS = 50;

export class Rma3ExportError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
  }
}

export function assertPeriod(period: unknown): string {
  if (typeof period !== "string" || !isMonthlyPeriod(period)) throw new Rma3ExportError("invalid_period");
  return period;
}

export async function loadRma3Mappings(tenantId: string): Promise<Rma3Mapping[]> {
  const rows = await prisma.dhis2Rma3Mapping.findMany({ where: { tenantId }, select: { indicatorCode: true, tableKey: true, cellKey: true, dataElementId: true, categoryOptionComboId: true } });
  return rows;
}

// Everything a screen or an export needs about one month.
export async function buildRma3Export(tenantId: string, period: string) {
  const report = await computeRma3Report(tenantId, period);
  const { values, duplicates } = flattenRma3Report(report);
  const [mappings, config] = await Promise.all([loadRma3Mappings(tenantId), getDhis2Config(tenantId)]);
  const built = buildDataValues(values, mappings);
  return {
    period,
    // The monthly form of the month: a push needs it validated (locked), a file does not.
    manualStatus: report.manual.status,
    values,
    duplicates,
    mappings,
    dataValues: built.dataValues,
    unmapped: built.unmapped,
    collisions: built.collisions,
    coverage: mappingCoverage(values, mappings),
    target: config ? { dataSetId: config.dataSetId, orgUnitId: config.orgUnitId, baseUrl: config.baseUrl, hasCredentials: Boolean(config.username && config.encryptedPassword) } : null,
  };
}

export interface Rma3PushResult {
  ok: boolean;
  dryRun: boolean;
  sent: number;
  chunks: number;
  importCount: Dhis2ImportCount;
  conflicts: Dhis2Conflict[];
  error?: string;
}

export async function pushRma3(tenantId: string, period: string, { dryRun }: { dryRun: boolean }): Promise<Rma3PushResult> {
  const config = await getDhis2Config(tenantId);
  if (!config || !config.baseUrl || !config.username || !config.encryptedPassword) throw new Rma3ExportError("dhis2_not_configured");
  if (!config.dataSetId || !config.orgUnitId) throw new Rma3ExportError("dhis2_target_missing");

  const built = await buildRma3Export(tenantId, period);
  // A month still being filled in is not final: only the simulation may run on it.
  if (!dryRun && built.manualStatus !== "validated") throw new Rma3ExportError("rma3_period_not_validated", 409);
  if (built.dataValues.length === 0) throw new Rma3ExportError("nothing_mapped");

  const credentials = { baseUrl: config.baseUrl, username: config.username, password: decryptSecret(config.encryptedPassword) };
  const total: Dhis2ImportCount = { imported: 0, updated: 0, ignored: 0, deleted: 0 };
  const conflicts: Dhis2Conflict[] = [];
  const parts = chunk(built.dataValues, PUSH_CHUNK_SIZE);

  for (const part of parts) {
    const payload = buildDataValueSet({ dataSetId: config.dataSetId, orgUnitId: config.orgUnitId, period, dataValues: part });
    const result = await submitDataValueSet(credentials, { dataSetId: payload.dataSet, orgUnitId: payload.orgUnit, period: payload.period, dataValues: payload.dataValues, dryRun });
    for (const k of ["imported", "updated", "ignored", "deleted"] as const) total[k] += result.importCount?.[k] ?? 0;
    for (const c of result.conflicts ?? []) if (conflicts.length < MAX_REPORTED_CONFLICTS) conflicts.push(c);
    if (!result.ok) {
      return { ok: false, dryRun, sent: built.dataValues.length, chunks: parts.length, importCount: total, conflicts, error: result.error ?? `DHIS2 responded with HTTP ${result.status}` };
    }
  }
  return { ok: true, dryRun, sent: built.dataValues.length, chunks: parts.length, importCount: total, conflicts };
}

// Reads the national data set and proposes the mappings it can establish with certainty.
export async function proposeRma3Mappings(tenantId: string, period: string) {
  const config = await getDhis2Config(tenantId);
  if (!config || !config.baseUrl || !config.username || !config.encryptedPassword) throw new Rma3ExportError("dhis2_not_configured");
  if (!config.dataSetId) throw new Rma3ExportError("dhis2_target_missing");

  const [report, mappings, elements] = await Promise.all([
    computeRma3Report(tenantId, period),
    loadRma3Mappings(tenantId),
    fetchDataSetStructure({ baseUrl: config.baseUrl, username: config.username, password: decryptSecret(config.encryptedPassword) }, config.dataSetId),
  ]);
  const { values } = flattenRma3Report(report);
  return { elements: elements.length, ...proposeMappings(values, elements, mappings), cells: values.length };
}

export async function saveRma3Mappings(tenantId: string, userId: string, mappings: readonly Rma3Mapping[], source: "csv" | "dhis2" | "manual") {
  if (mappings.length === 0) return;
  // One statement: the whole file is applied or none of it (several thousand rows are too many for
  // one upsert each). The table's CHECK constraints re-validate every DHIS2 UID.
  await prisma.$executeRaw`
    INSERT INTO "tenant_template"."dhis2_rma3_mappings"
      ("id", "tenant_id", "indicator_code", "table_key", "cell_key", "data_element_id", "category_option_combo_id", "source", "updated_by_id", "updated_at")
    SELECT gen_random_uuid(), ${tenantId}::uuid, t.indicator_code, t.table_key, t.cell_key, t.data_element_id, NULLIF(t.coc, ''), ${source}, ${userId}::uuid, now()
    FROM unnest(
      ${mappings.map((m) => m.indicatorCode)}::text[],
      ${mappings.map((m) => m.tableKey)}::text[],
      ${mappings.map((m) => m.cellKey)}::text[],
      ${mappings.map((m) => m.dataElementId)}::text[],
      ${mappings.map((m) => m.categoryOptionComboId ?? "")}::text[]
    ) AS t(indicator_code, table_key, cell_key, data_element_id, coc)
    ON CONFLICT ("tenant_id", "indicator_code", "table_key", "cell_key") DO UPDATE SET
      "data_element_id" = EXCLUDED."data_element_id",
      "category_option_combo_id" = EXCLUDED."category_option_combo_id",
      "source" = EXCLUDED."source",
      "updated_by_id" = EXCLUDED."updated_by_id",
      "updated_at" = now()
  `;
}

export function rma3ErrorResponse(error: unknown): { code: string; status: number } {
  if (error instanceof Rma3ExportError) return { code: error.code, status: error.status };
  return { code: "export_failed", status: 500 };
}
