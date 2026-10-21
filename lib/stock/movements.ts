import { Prisma, type StockMovementType } from "@prisma/client";
import { isExpired, planFefo } from "@/lib/stock/fefo";

// The ONLY code that changes stock. Every entry/exit:
//  1. locks the article row (SELECT … FOR UPDATE), so concurrent movements on the same
//     article are serialized and the lots read below stay accurate until commit;
//  2. updates the lot(s) and the article's total (`stock` = sum of the lots);
//  3. appends one StockMovement per lot touched, with the article's balance afterwards.
// Callers pass their transaction client so the movement commits together with the
// business record (dispensing, vaccination…) or not at all.

type Tx = Prisma.TransactionClient;

export type StockErrorCode = "item_not_found" | "insufficient_stock" | "lot_not_found" | "lot_expired" | "lot_expiry_mismatch";

export class StockError extends Error {
  constructor(
    readonly code: StockErrorCode,
    readonly details: { available?: number; itemName?: string } = {}
  ) {
    super(code);
  }
}

interface Actor {
  tenantId: string;
  userId: string;
}

interface Source {
  sourceType?: string;
  sourceId?: string;
}

async function lockItem(tx: Tx, tenantId: string, itemId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; name: string; stock: number }>>(Prisma.sql`
    SELECT id::text AS id, name, stock
    FROM "tenant_template"."medication_inventory"
    WHERE id = ${itemId}::uuid AND tenant_id = ${tenantId}::uuid
    FOR UPDATE
  `);
  if (rows.length === 0) throw new StockError("item_not_found");
  return rows[0];
}

// ── Entries ─────────────────────────────────────────────────────────────────

export interface ReceiveStockInput extends Actor {
  itemId: string;
  lotNumber: string;
  expiryDate: Date | null;
  quantity: number;
  unitCost?: number | null;
  supplierId?: string | null;
  reason?: string | null;
  occurredAt: Date;
}

// A receipt adds to the lot with the same number, or creates it. The same lot number with a
// different expiry date is refused: it is a typo or two different batches.
export async function receiveStock(tx: Tx, input: ReceiveStockInput) {
  const item = await lockItem(tx, input.tenantId, input.itemId);
  const existing = await tx.stockLot.findUnique({ where: { itemId_lotNumber: { itemId: item.id, lotNumber: input.lotNumber } } });
  if (existing && (existing.expiryDate?.getTime() ?? null) !== (input.expiryDate?.getTime() ?? null)) {
    throw new StockError("lot_expiry_mismatch");
  }
  const lot = existing
    ? await tx.stockLot.update({ where: { id: existing.id }, data: { quantity: { increment: input.quantity } } })
    : await tx.stockLot.create({
        data: {
          tenantId: input.tenantId,
          itemId: item.id,
          lotNumber: input.lotNumber,
          expiryDate: input.expiryDate,
          quantity: input.quantity,
          receivedAt: input.occurredAt,
        },
      });
  const balanceAfter = item.stock + input.quantity;
  await tx.medicationInventory.update({ where: { id: item.id }, data: { stock: balanceAfter } });
  return tx.stockMovement.create({
    data: {
      tenantId: input.tenantId,
      itemId: item.id,
      lotId: lot.id,
      type: "receipt",
      quantity: input.quantity,
      balanceAfter,
      reason: input.reason ?? null,
      supplierId: input.supplierId ?? null,
      unitCost: input.unitCost ?? null,
      occurredAt: input.occurredAt,
      recordedById: input.userId,
    },
  });
}

// ── Exits ───────────────────────────────────────────────────────────────────

export type ExitType = Extract<StockMovementType, "dispensing" | "vaccination" | "expired" | "damaged" | "lost">;

export interface ConsumeStockInput extends Actor, Source {
  itemId: string;
  quantity: number;
  type: ExitType;
  // A specific lot (vaccination, loss of a given lot); otherwise FEFO across the lots.
  lotId?: string | null;
  reason?: string | null;
  occurredAt: Date;
}

// Takes stock out, FEFO unless a lot is given. Refuses (StockError) rather than going
// negative: the caller's transaction rolls back and nothing is recorded.
export async function consumeStock(tx: Tx, input: ConsumeStockInput) {
  const item = await lockItem(tx, input.tenantId, input.itemId);
  const lots = await tx.stockLot.findMany({
    where: { itemId: item.id, quantity: { gt: 0 }, ...(input.lotId ? { id: input.lotId } : {}) },
    select: { id: true, lotNumber: true, expiryDate: true, quantity: true },
  });
  // Expired stock may only leave as a destruction ("expired"), never to a patient.
  const allowExpired = input.type === "expired" || input.type === "damaged" || input.type === "lost";

  if (input.lotId) {
    const lot = await tx.stockLot.findFirst({ where: { id: input.lotId, itemId: item.id }, select: { expiryDate: true } });
    if (!lot) throw new StockError("lot_not_found");
    if (!allowExpired && isExpired(lot.expiryDate, input.occurredAt)) throw new StockError("lot_expired");
  }

  const plan = planFefo(lots, input.quantity, input.occurredAt, { allowExpired });
  if (!plan.ok) throw new StockError("insufficient_stock", { available: plan.available, itemName: item.name });

  let balance = item.stock;
  const movements = [];
  for (const allocation of plan.allocations) {
    await tx.stockLot.update({ where: { id: allocation.lotId }, data: { quantity: { decrement: allocation.quantity } } });
    balance -= allocation.quantity;
    movements.push({
      tenantId: input.tenantId,
      itemId: item.id,
      lotId: allocation.lotId,
      type: input.type,
      quantity: -allocation.quantity,
      balanceAfter: balance,
      reason: input.reason ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      occurredAt: input.occurredAt,
      recordedById: input.userId,
    });
  }
  await tx.medicationInventory.update({ where: { id: item.id }, data: { stock: balance } });
  await tx.stockMovement.createMany({ data: movements });
  const lotsById = new Map(lots.map((lot) => [lot.id, lot]));
  return {
    allocations: plan.allocations.map((a) => ({ ...a, lotNumber: lotsById.get(a.lotId)!.lotNumber, expiryDate: lotsById.get(a.lotId)!.expiryDate })),
    balanceAfter: balance,
  };
}

// ── Inventory count ─────────────────────────────────────────────────────────

export interface CountLotInput extends Actor {
  itemId: string;
  lotId: string;
  countedQuantity: number;
  reason: string;
}

// Physical count of one lot: records the difference as an "adjustment" (nothing when the
// count matches the books).
export async function countLot(tx: Tx, input: CountLotInput) {
  const item = await lockItem(tx, input.tenantId, input.itemId);
  const lot = await tx.stockLot.findFirst({ where: { id: input.lotId, itemId: item.id } });
  if (!lot) throw new StockError("lot_not_found");
  const delta = input.countedQuantity - lot.quantity;
  if (delta === 0) return null;
  const balanceAfter = item.stock + delta;
  await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: input.countedQuantity } });
  await tx.medicationInventory.update({ where: { id: item.id }, data: { stock: balanceAfter } });
  return tx.stockMovement.create({
    data: {
      tenantId: input.tenantId,
      itemId: item.id,
      lotId: lot.id,
      type: "adjustment",
      quantity: delta,
      balanceAfter,
      reason: input.reason,
      occurredAt: new Date(),
      recordedById: input.userId,
    },
  });
}

// JSON body for a StockError (409: the request is valid but the stock does not allow it).
export function stockErrorResponse(error: StockError) {
  const status = error.code === "item_not_found" || error.code === "lot_not_found" ? 404 : 409;
  return {
    status,
    body: { error: error.code, code: error.code, available: error.details.available, item: error.details.itemName, success: false },
  };
}
