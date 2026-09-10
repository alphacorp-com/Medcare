import prisma from "@/lib/prisma";
import { submitDataValueSet, toDataValues } from "./client";
import { decryptSecret } from "./crypto";
import { computeMonthlyIndicators, Dhis2Period, previousMonthPeriod } from "./indicators";
import { Dhis2Config, Dhis2Conflict, Dhis2ImportCount } from "./types";

const DHIS2_SETTING_KEY = "dhis2";
// Fixed placeholder actor for cron-triggered audit log rows (AuditLog.actorId is non-nullable).
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

export interface Dhis2SyncSummary {
  tenantId: string;
  period: Dhis2Period;
  status: "success" | "skipped" | "failed";
  dataValueCount?: number;
  unmappedMetrics?: string[];
  importCount?: Dhis2ImportCount;
  conflicts?: Dhis2Conflict[];
  error?: string;
}

export async function getDhis2Config(tenantId: string): Promise<Dhis2Config | null> {
  const setting = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: DHIS2_SETTING_KEY } },
  });
  if (!setting) return null;
  return setting.value as unknown as Dhis2Config;
}

export async function saveDhis2Config(
  tenantId: string,
  config: Dhis2Config,
  updatedBy?: string
): Promise<void> {
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key: DHIS2_SETTING_KEY } },
    create: { tenantId, key: DHIS2_SETTING_KEY, value: config as any, updatedBy },
    update: { value: config as any, updatedBy },
  });
}

async function logSyncAttempt(summary: Dhis2SyncSummary, triggeredBy: "cron" | string) {
  await prisma.auditLog.create({
    data: {
      tenantId: summary.tenantId,
      actorId: triggeredBy === "cron" ? SYSTEM_ACTOR_ID : triggeredBy,
      actorType: triggeredBy === "cron" ? "system" : "tenant_user",
      action: "dhis2.sync",
      resourceType: "dhis2_sync",
      payload: summary as any,
    },
  });
}

export async function runDhis2Sync(
  tenantId: string,
  period: Dhis2Period = previousMonthPeriod(),
  triggeredBy: "cron" | string = "cron"
): Promise<Dhis2SyncSummary> {
  const config = await getDhis2Config(tenantId);

  if (!config || !config.enabled) {
    const summary: Dhis2SyncSummary = { tenantId, period, status: "skipped" };
    return summary;
  }

  try {
    const values = await computeMonthlyIndicators(tenantId, period);
    const { dataValues, unmapped } = toDataValues(values, config.mappings);

    if (dataValues.length === 0) {
      const summary: Dhis2SyncSummary = {
        tenantId,
        period,
        status: "failed",
        unmappedMetrics: unmapped,
        error: "No indicators are mapped to DHIS2 data elements yet.",
      };
      await logSyncAttempt(summary, triggeredBy);
      return summary;
    }

    const password = decryptSecret(config.encryptedPassword);
    const result = await submitDataValueSet(
      { baseUrl: config.baseUrl, username: config.username, password },
      { dataSetId: config.dataSetId, orgUnitId: config.orgUnitId, period, dataValues }
    );

    const summary: Dhis2SyncSummary = {
      tenantId,
      period,
      status: result.ok ? "success" : "failed",
      dataValueCount: dataValues.length,
      unmappedMetrics: unmapped,
      importCount: result.importCount,
      conflicts: result.conflicts,
      error: result.error,
    };
    await logSyncAttempt(summary, triggeredBy);
    return summary;
  } catch (error) {
    const summary: Dhis2SyncSummary = {
      tenantId,
      period,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error during DHIS2 sync",
    };
    console.error(`DHIS2 sync failed for tenant ${tenantId}, period ${period}:`, error);
    await logSyncAttempt(summary, triggeredBy);
    return summary;
  }
}

export async function runDhis2SyncForAllTenants(
  period: Dhis2Period = previousMonthPeriod()
): Promise<Dhis2SyncSummary[]> {
  const settings = await prisma.tenantSetting.findMany({ where: { key: DHIS2_SETTING_KEY } });
  const enabledTenantIds = settings
    .filter((s) => (s.value as unknown as Dhis2Config)?.enabled)
    .map((s) => s.tenantId);

  const summaries: Dhis2SyncSummary[] = [];
  for (const tenantId of enabledTenantIds) {
    summaries.push(await runDhis2Sync(tenantId, period, "cron"));
  }
  return summaries;
}
