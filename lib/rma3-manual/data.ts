import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { readIdentification, type Rma3IdentificationSettings, type Rma3ValueChange } from "@/lib/rma3-manual/input";

// Reads and writes of the RMA3 monthly form. Every query is scoped to the caller's tenant;
// the routes pass the tenant of the session, never one sent by the browser.

type Tx = Prisma.TransactionClient;

export class Rma3ManualError extends Error {
  constructor(
    public readonly code: "period_validated" | "period_not_validated" | "period_not_found",
    public readonly status: 404 | 409
  ) {
    super(code);
  }
}

// code → breakdown key → value
export type Rma3ManualValues = Record<string, Record<string, number>>;

export interface Rma3ManualForm {
  period: string;
  status: "draft" | "validated";
  validatedAt: Date | null;
  validatedById: string | null;
  updatedAt: Date | null;
  values: Rma3ManualValues;
}

export async function loadManualForm(tenantId: string, period: string): Promise<Rma3ManualForm> {
  const row = await prisma.rma3ManualPeriod.findUnique({
    where: { tenantId_period: { tenantId, period } },
    include: { values: { select: { indicatorCode: true, breakdownKey: true, value: true } } },
  });
  const values: Rma3ManualValues = {};
  for (const v of row?.values ?? []) {
    (values[v.indicatorCode] ??= {})[v.breakdownKey] = v.value.toNumber();
  }
  return {
    period,
    status: row?.status ?? "draft",
    validatedAt: row?.validatedAt ?? null,
    validatedById: row?.validatedById ?? null,
    updatedAt: row?.updatedAt ?? null,
    values,
  };
}

// The period row, created as a draft on first write, locked until the transaction ends so a
// concurrent validation cannot interleave with a save.
async function lockPeriod(tx: Tx, tenantId: string, period: string): Promise<{ id: string; status: "draft" | "validated" }> {
  await tx.rma3ManualPeriod.upsert({
    where: { tenantId_period: { tenantId, period } },
    create: { tenantId, period },
    update: {},
  });
  const rows = await tx.$queryRaw<{ id: string; status: "draft" | "validated" }[]>(Prisma.sql`
    SELECT id::text AS id, status::text AS status
    FROM "tenant_template"."rma3_manual_periods"
    WHERE tenant_id = ${tenantId}::uuid AND period = ${period}
    FOR UPDATE
  `);
  if (rows.length === 0) throw new Rma3ManualError("period_not_found", 404);
  return rows[0];
}

// Applies the changes of a draft month: a value is upserted, null deletes the cell.
export async function saveManualValues(tenantId: string, period: string, changes: readonly Rma3ValueChange[], userId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const locked = await lockPeriod(tx, tenantId, period);
    if (locked.status === "validated") throw new Rma3ManualError("period_validated", 409);

    for (const change of changes) {
      const where = { periodId_indicatorCode_breakdownKey: { periodId: locked.id, indicatorCode: change.code, breakdownKey: change.key } };
      if (change.value === null) {
        await tx.rma3ManualValue.deleteMany({ where: { periodId: locked.id, indicatorCode: change.code, breakdownKey: change.key } });
      } else {
        await tx.rma3ManualValue.upsert({
          where,
          create: { tenantId, periodId: locked.id, indicatorCode: change.code, breakdownKey: change.key, value: change.value, updatedById: userId },
          update: { value: change.value, updatedById: userId },
        });
      }
    }
    // Touch the period so its updatedAt tells when the form last changed.
    await tx.rma3ManualPeriod.update({ where: { id: locked.id }, data: { updatedAt: new Date() } });
    return changes.length;
    // Up to 1 000 cells, one statement each: more than Prisma's default 5 s may be needed.
  }, { timeout: 20_000 });
}

export async function validateManualPeriod(tenantId: string, period: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const locked = await lockPeriod(tx, tenantId, period);
    if (locked.status === "validated") throw new Rma3ManualError("period_validated", 409);
    await tx.rma3ManualPeriod.update({ where: { id: locked.id }, data: { status: "validated", validatedById: userId, validatedAt: new Date() } });
  });
}

export async function reopenManualPeriod(tenantId: string, period: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.rma3ManualPeriod.findUnique({ where: { tenantId_period: { tenantId, period } }, select: { id: true } });
    if (!existing) throw new Rma3ManualError("period_not_validated", 409);
    const locked = await lockPeriod(tx, tenantId, period);
    if (locked.status !== "validated") throw new Rma3ManualError("period_not_validated", 409);
    await tx.rma3ManualPeriod.update({ where: { id: locked.id }, data: { status: "draft", validatedById: null, validatedAt: null } });
  });
}

// ── MINSANTE identification (TenantSetting, public schema) ──────────────────

const IDENTIFICATION_KEY = "rma3.identification";

export async function loadIdentification(tenantId: string): Promise<Rma3IdentificationSettings> {
  const setting = await prisma.tenantSetting.findUnique({ where: { tenantId_key: { tenantId, key: IDENTIFICATION_KEY } }, select: { value: true } });
  return readIdentification(setting?.value ?? null);
}

export async function saveIdentification(tenantId: string, value: Rma3IdentificationSettings, userId: string): Promise<void> {
  const json = value as unknown as Prisma.InputJsonValue;
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key: IDENTIFICATION_KEY } },
    create: { tenantId, key: IDENTIFICATION_KEY, value: json, updatedBy: userId },
    update: { value: json, updatedBy: userId },
  });
}
