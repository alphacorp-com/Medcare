import {
  Dhis2Conflict,
  Dhis2ImportCount,
  Dhis2MetricValue,
  Dhis2SubmitResult,
  Dhis2TestConnectionResult,
} from "./types";
import { DHIS2_UID } from "./rma3-export";
import type { Dhis2DataElementStructure } from "./rma3-mapping";

export interface Dhis2Credentials {
  baseUrl: string;
  username: string;
  password: string;
}

function authHeader(credentials: Dhis2Credentials): string {
  const token = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
  return `Basic ${token}`;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export async function testConnection(credentials: Dhis2Credentials): Promise<Dhis2TestConnectionResult> {
  try {
    const res = await fetch(`${normalizeBaseUrl(credentials.baseUrl)}/api/me.json?fields=id,displayName`, {
      method: "GET",
      headers: { Authorization: authHeader(credentials) },
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: `DHIS2 responded with HTTP ${res.status}` };
    }

    const body = await res.json();
    return { ok: true, status: res.status, displayName: body.displayName };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network error contacting DHIS2",
    };
  }
}

export async function submitDataValueSet(
  credentials: Dhis2Credentials,
  params: {
    dataSetId: string;
    orgUnitId: string;
    period: string;
    dataValues: { dataElement: string; categoryOptionCombo?: string; value: string }[];
    // DHIS2 validates the whole payload and reports what it would import, without saving anything.
    dryRun?: boolean;
  }
): Promise<Dhis2SubmitResult> {
  try {
    const url = new URL(`${normalizeBaseUrl(credentials.baseUrl)}/api/dataValueSets`);
    if (params.dryRun) url.searchParams.set("dryRun", "true");
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: authHeader(credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dataSet: params.dataSetId,
        orgUnit: params.orgUnitId,
        period: params.period,
        dataValues: params.dataValues,
      }),
    });

    const body = await res.json().catch(() => null);
    // DHIS2 wraps the summary under `response` on newer/async-style payloads,
    // but the classic sync dataValueSets endpoint returns it at the top level.
    const summary = body?.response ?? body ?? {};
    const importCount: Dhis2ImportCount | undefined = summary.importCount;
    const conflicts: Dhis2Conflict[] | undefined = summary.conflicts;

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        importCount,
        conflicts,
        error: body?.message || `DHIS2 responded with HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status, importCount, conflicts };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network error contacting DHIS2",
    };
  }
}

export interface Dhis2EntityRef {
  id: string;
  name: string;
}

async function searchEntities(
  credentials: Dhis2Credentials,
  entity: "organisationUnits" | "dataSets" | "dataElements",
  query: string,
  extraFilters: string[] = []
): Promise<Dhis2EntityRef[]> {
  const url = new URL(`${normalizeBaseUrl(credentials.baseUrl)}/api/${entity}.json`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("paging", "true");
  url.searchParams.set("pageSize", "20");
  if (query.trim()) url.searchParams.set("filter", `name:ilike:${query.trim()}`);
  for (const filter of extraFilters) url.searchParams.append("filter", filter);

  const res = await fetch(url.toString(), { headers: { Authorization: authHeader(credentials) } });
  if (!res.ok) {
    throw new Error(`DHIS2 ${entity} lookup failed (HTTP ${res.status})`);
  }
  const body = await res.json();
  return (body?.[entity] ?? []) as Dhis2EntityRef[];
}

export function searchOrgUnits(credentials: Dhis2Credentials, query: string): Promise<Dhis2EntityRef[]> {
  return searchEntities(credentials, "organisationUnits", query);
}

export function searchDataSets(credentials: Dhis2Credentials, query: string): Promise<Dhis2EntityRef[]> {
  return searchEntities(credentials, "dataSets", query);
}

export function searchDataElements(
  credentials: Dhis2Credentials,
  query: string,
  dataSetId?: string
): Promise<Dhis2EntityRef[]> {
  const extraFilters = dataSetId ? [`dataSetElements.dataSet.id:eq:${dataSetId}`] : [];
  return searchEntities(credentials, "dataElements", query, extraFilters);
}

export function toDataValues(
  values: Dhis2MetricValue[],
  mappings: { metricKey: string; dataElementId: string; categoryOptionComboId?: string }[]
) {
  const mappingByMetric = new Map(mappings.map((m) => [m.metricKey, m]));
  const dataValues: { dataElement: string; categoryOptionCombo?: string; value: string }[] = [];
  const unmapped: string[] = [];

  for (const { metricKey, value } of values) {
    const mapping = mappingByMetric.get(metricKey);
    if (!mapping) {
      unmapped.push(metricKey);
      continue;
    }
    dataValues.push({
      dataElement: mapping.dataElementId,
      categoryOptionCombo: mapping.categoryOptionComboId,
      value: String(value),
    });
  }

  return { dataValues, unmapped };
}

// ── Structure of a data set (for the RMA3 mapping) ─────────────────────────

interface RawCombo { id: string; name: string; code?: string | null }
interface RawCategoryCombo { categoryOptionCombos?: RawCombo[] }
interface RawDataSetElement {
  categoryCombo?: RawCategoryCombo | null;
  dataElement?: { id: string; name: string; shortName?: string | null; code?: string | null; categoryCombo?: RawCategoryCombo | null } | null;
}

// The data elements of a data set with their category option combos: the targets the RMA3 values
// can be sent to. A data set may override an element's category combo; that one wins.
export async function fetchDataSetStructure(credentials: Dhis2Credentials, dataSetId: string): Promise<Dhis2DataElementStructure[]> {
  // The id goes into the URL path: only a genuine DHIS2 UID is accepted.
  if (!DHIS2_UID.test(dataSetId)) throw new Error("Invalid data set id");
  const fields =
    "dataSetElements[categoryCombo[categoryOptionCombos[id,name,code]],dataElement[id,name,shortName,code,categoryCombo[categoryOptionCombos[id,name,code]]]]";
  const res = await fetch(`${normalizeBaseUrl(credentials.baseUrl)}/api/dataSets/${dataSetId}.json?fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: authHeader(credentials) },
  });
  if (!res.ok) throw new Error(`DHIS2 data set lookup failed (HTTP ${res.status})`);
  const body = (await res.json()) as { dataSetElements?: RawDataSetElement[] };
  const out: Dhis2DataElementStructure[] = [];
  for (const dse of body.dataSetElements ?? []) {
    const element = dse.dataElement;
    if (!element) continue;
    const combos = dse.categoryCombo?.categoryOptionCombos ?? element.categoryCombo?.categoryOptionCombos ?? [];
    out.push({ id: element.id, name: element.name, shortName: element.shortName ?? null, code: element.code ?? null, combos });
  }
  return out;
}
