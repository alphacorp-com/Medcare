import prisma from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { DHIS2_SETTING_KEY, getDhis2Config, hasApiAccess } from "./config";
import { pushRma3, Rma3ExportError } from "./rma3-sync";
import { periodsToSend, AUTO_SEND_WINDOW_DAYS } from "./rma3-schedule";
import type { Dhis2Config } from "./types";

// Automatic send of the RMA3 to DHIS2 through its API (cron /api/cron/sync-dhis2). The only DHIS2
// circuit of MedCare: the RMA3 holds every figure the national data set expects, broken down as
// the form requires, so nothing else is sent (an aggregate total would overwrite the broken-down
// cells of the same data element).
//
// Runs only for a facility that enabled it and has an API account. Sends each validated month
// not sent since its validation (see rma3-schedule.ts). Every attempt is an audit line
// `dhis2.rma3_push` (trigger "auto"), shown in the DHIS2 history next to the manual sends.

// Fixed placeholder actor for cron-written audit rows (AuditLog.actorId is non-nullable).
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";
export const RMA3_PUSH_ACTION = "dhis2.rma3_push";

export interface Rma3AutoSendResult {
  tenantId: string;
  period: string;
  ok: boolean;
  sent?: number;
  error?: string;
}

// Last real send attempt (simulations excluded) of each of these months.
async function lastAttempts(tenantId: string, periods: readonly string[]): Promise<Map<string, Date>> {
  if (periods.length === 0) return new Map();
  const rows = await prisma.auditLog.findMany({
    where: { tenantId, action: RMA3_PUSH_ACTION, resourceId: { in: [...periods] } },
    select: { resourceId: true, createdAt: true, payload: true },
    orderBy: { createdAt: "desc" },
  });
  const last = new Map<string, Date>();
  for (const row of rows) {
    if (!row.resourceId || last.has(row.resourceId)) continue;
    if ((row.payload as { dryRun?: boolean } | null)?.dryRun === true) continue;
    last.set(row.resourceId, row.createdAt);
  }
  return last;
}

async function sendPeriod(tenantId: string, period: string): Promise<Rma3AutoSendResult> {
  let result: Rma3AutoSendResult;
  let detail: Record<string, unknown> = {};
  try {
    const push = await pushRma3(tenantId, period, { dryRun: false });
    result = { tenantId, period, ok: push.ok, sent: push.sent, error: push.error };
    detail = { importCount: push.importCount, conflicts: push.conflicts.length };
  } catch (error) {
    // Configuration problems (nothing mapped, form reopened meanwhile…) keep their code; anything
    // else is logged server side and recorded without its internal message.
    if (!(error instanceof Rma3ExportError)) console.error(`[dhis2 auto-send] tenant ${tenantId}, period ${period}`, error);
    result = { tenantId, period, ok: false, error: error instanceof Rma3ExportError ? error.code : "export_failed" };
  }
  await recordAuditEvent({
    tenantId,
    actorId: SYSTEM_ACTOR_ID,
    actorType: "system",
    action: RMA3_PUSH_ACTION,
    resourceType: "dhis2_rma3",
    resourceId: period,
    payload: { period, trigger: "auto", dryRun: false, ok: result.ok, sent: result.sent ?? 0, error: result.error ?? null, ...detail },
  });
  return result;
}

export async function runRma3AutoSend(tenantId: string, now: Date = new Date()): Promise<Rma3AutoSendResult[]> {
  const config = await getDhis2Config(tenantId);
  if (!config?.enabled || !hasApiAccess(config)) return [];

  const since = new Date(now.getTime() - AUTO_SEND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const validated = await prisma.rma3ManualPeriod.findMany({
    where: { tenantId, status: "validated", validatedAt: { gte: since } },
    select: { period: true, validatedAt: true },
  });
  const candidates = validated.flatMap((v) => (v.validatedAt ? [{ period: v.period, validatedAt: v.validatedAt }] : []));
  const due = periodsToSend(candidates, await lastAttempts(tenantId, candidates.map((c) => c.period)), now);

  const results: Rma3AutoSendResult[] = [];
  for (const period of due) results.push(await sendPeriod(tenantId, period));
  return results;
}

export async function runRma3AutoSendForAllTenants(now: Date = new Date()): Promise<Rma3AutoSendResult[]> {
  const settings = await prisma.tenantSetting.findMany({ where: { key: DHIS2_SETTING_KEY }, select: { tenantId: true, value: true } });
  const results: Rma3AutoSendResult[] = [];
  for (const setting of settings) {
    if (!(setting.value as unknown as Dhis2Config | null)?.enabled) continue;
    // One facility's failure must not stop the others.
    try {
      results.push(...(await runRma3AutoSend(setting.tenantId, now)));
    } catch (error) {
      console.error(`[dhis2 auto-send] tenant ${setting.tenantId}`, error);
      results.push({ tenantId: setting.tenantId, period: "", ok: false, error: "export_failed" });
    }
  }
  return results;
}
