import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

// A room type's (salle) daily hospitalisation price lives in the tariff grid, under
// FeeSchedule (sourceType "hospitalization", code = room type code) — the same place every
// other billed price lives, writable only by the tenant admin. It is edited from
// Settings > Room types alongside the room type itself.
//
// Unlike lib/billing/syncFeeSchedule.ts, these never swallow errors: the admin must know if
// a price didn't save, otherwise hospitalising into that room fails later with no price.
const SOURCE = "hospitalization" as const;

// FeeSchedule.isActive here only means "a price is set". Whether patients can be admitted
// into the room is the room type's own isActive — so toggling a room off and on again
// keeps its price.
export async function setRoomTypeDailyPrice(
  db: Db,
  params: { tenantId: string; code: string; label: string; price: number | null }
): Promise<void> {
  const { tenantId, code, label, price } = params;
  if (price == null) {
    // No price: deactivate rather than delete, so past invoices' tariff code stays resolvable.
    await db.feeSchedule.updateMany({ where: { tenantId, sourceType: SOURCE, code }, data: { isActive: false } });
    return;
  }
  await db.feeSchedule.upsert({
    where: { tenantId_sourceType_code: { tenantId, sourceType: SOURCE, code } },
    update: { label, unitPrice: price, isActive: true },
    create: { tenantId, sourceType: SOURCE, code, label, unitPrice: price, isActive: true },
  });
}

export async function getRoomTypeDailyPrice(db: Db, tenantId: string | null, code: string): Promise<number | null> {
  const fee = await db.feeSchedule.findFirst({ where: { tenantId, sourceType: SOURCE, code, isActive: true } });
  return fee ? Number(fee.unitPrice) : null;
}

// For a renamed or deleted room type — its old tariff must no longer be billable.
export async function deactivateRoomTypeDailyPrice(db: Db, tenantId: string | null, code: string): Promise<void> {
  await db.feeSchedule.updateMany({ where: { tenantId, sourceType: SOURCE, code }, data: { isActive: false } });
}

// Active daily price per room type code (codes without an active price are absent).
export async function getRoomTypeDailyPrices(tenantId: string): Promise<Map<string, number>> {
  const fees = await prisma.feeSchedule.findMany({
    where: { tenantId, sourceType: SOURCE, isActive: true },
    select: { code: true, unitPrice: true },
  });
  return new Map(fees.map((fee) => [fee.code, Number(fee.unitPrice)]));
}

// Parses a daily price from a request body: undefined = not provided, null/"" = cleared.
export function parseDailyPrice(value: unknown): { ok: true; price: number | null | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, price: undefined };
  if (value === null || value === "") return { ok: true, price: null };
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? { ok: true, price } : { ok: false };
}
