import {
  Dhis2Conflict,
  Dhis2ImportCount,
  Dhis2MetricValue,
  Dhis2SubmitResult,
  Dhis2TestConnectionResult,
} from "./types";

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
  }
): Promise<Dhis2SubmitResult> {
  try {
    const res = await fetch(`${normalizeBaseUrl(credentials.baseUrl)}/api/dataValueSets`, {
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
