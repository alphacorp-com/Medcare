import { Prisma, type StockMovementType } from "@prisma/client";
import { isExpired, planFefo } from "@/lib/stock/fefo";
import { dispensingLocationId } from "@/lib/stock/locations";

// The ONLY code that changes stock. Every entry/exit:
//  1. locks the article row (SELECT … FOR UPDATE), so concurrent movements on the same
//     article are serialized and the lots read below stay accurate until commit;
//  2. updates the lot(s) and the article's total (`stock` = sum of its lots, all depots);
//  3. appends one StockMovement per lot touched, with the article's total afterwards;
//  4. when the movement is back-dated, recomputes every later "balance after" so the
//     journal reads in chronological order (refused if the stock would have been negative).
// Callers pass their transaction client so the movement commits together with the
// business record (dispensing, vaccination…) or not at all.

type Tx = Prisma.TransactionClient;

export type StockErrorCode =
  | "item_not_found"
  | "insufficient_stock"
  | "lot_not_found"
  | "lot_expired"
  | "lot_expiry_mismatch"
  | "same_location"
  | "history_conflict"
  | "vial_config_missing";

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

export interface LockedItem {
  id: string;
  name: string;
  stock: number;
  storageLocationId: string | null;
  dosesPerUnit: number;
  openVialHours: number | null;
}

export async function lockItem(tx: Tx, tenantId: string, itemId: string): Promise<LockedItem> {
  const rows = await tx.$queryRaw<LockedItem[]>(Prisma.sql`
    SELECT id::text AS id, name, stock, storage_location_id::text AS "storageLocationId",
           doses_per_unit AS "dosesPerUnit", open_vial_hours AS "openVialHours"
    FROM "tenant_template"."medication_inventory"
    WHERE id = ${itemId}::uuid AND tenant_id = ${tenantId}::uuid
    FOR UPDATE
  `);
  if (rows.length === 0) throw new StockError("item_not_found");
  return rows[0];
}

// Recomputes the running balance of the article's journal in chronological order, when a
// movement was dated before existing ones. A back-dated exit that the stock of that day
// could not cover hits the balance_after >= 0 constraint: refused as history_conflict.
async function rebalanceIfBackdated(tx: Tx, itemId: string, occurredAt: Date) {
  const later = await tx.stockMovement.findFirst({ where: { itemId, occurredAt: { gt: occurredAt } }, select: { id: true } });
  if (!later) return;
  try {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "tenant_template"."stock_movements" m
      SET balance_after = r.running
      FROM (
        SELECT id, SUM(quantity) OVER (ORDER BY occurred_at, created_at, id) AS running
        FROM "tenant_template"."stock_movements"
        WHERE item_id = ${itemId}::uuid
      ) r
      WHERE m.id = r.id AND m.balance_after <> r.running
    `);
  } catch (error) {
    if (error instanceof Error && /23514|balance_non_negative/.test(error.message)) throw new StockError("history_conflict");
    throw error;
  }
}

// ── Entries ─────────────────────────────────────────────────────────────────

export interface ReceiveStockInput extends Actor {
  itemId: string;
  // Depot receiving the lot; the article's dispensing depot when omitted.
  locationId?: string | null;
  lotNumber: string;
  expiryDate: Date | null;
  quantity: number;
  unitCost?: number | null;
  supplierId?: string | null;
  reason?: string | null;
  occurredAt: Date;
}

// A receipt adds to the lot with the same number in that depot, or creates it. The same lot
// number with a different expiry date is refused: it is a typo or two different batches.
export async function receiveStock(tx: Tx, input: ReceiveStockInput) {
  const item = await lockItem(tx, input.tenantId, input.itemId);
  const locationId = input.locationId ?? (await dispensingLocationId(tx, input.tenantId, item.storageLocationId));
  const sameNumber = await tx.stockLot.findFirst({ where: { itemId: item.id, lotNumber: input.lotNumber }, select: { expiryDate: true } });
  if (sameNumber && (sameNumber.expiryDate?.getTime() ?? null) !== (input.expiryDate?.getTime() ?? null)) {
    throw new StockError("lot_expiry_mismatch");
  }
  const lot = await tx.stockLot.upsert({
    where: { itemId_lotNumber_locationId: { itemId: item.id, lotNumber: input.lotNumber, locationId } },
    update: { quantity: { increment: input.quantity } },
    create: {
      tenantId: input.tenantId,
      itemId: item.id,
      locationId,
      lotNumber: input.lotNumber,
      expiryDate: input.expiryDate,
      quantity: input.quantity,
      receivedAt: input.occurredAt,
    },
  });
  const balanceAfter = item.stock + input.quantity;
  await tx.medicationInventory.update({ where: { id: item.id }, data: { stock: balanceAfter } });
  const movement = await tx.stockMovement.create({
    data: {
      tenantId: input.tenantId,
      itemId: item.id,
      lotId: lot.id,
      locationId,
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
  await rebalanceIfBackdated(tx, item.id, input.occurredAt);
  return movement;
}

// ── Exits ───────────────────────────────────────────────────────────────────

export type ExitType = Extract<StockMovementType, "dispensing" | "vaccination" | "expired" | "damaged" | "lost">;

export interface ConsumeStockInput extends Actor, Source {
  itemId: string;
  quantity: number;
  type: ExitType;
  // A specific lot (vaccination, loss of a given lot); otherwise FEFO across the lots of
  // `locationId` (default: the article's dispensing depot).
  lotId?: string | null;
  locationId?: string | null;
  reason?: string | null;
  occurredAt: Date;
}

export interface ConsumeResult {
  allocations: { lotId: string; quantity: number; lotNumber: string; expiryDate: Date | null }[];
  balanceAfter: number;
}

// Takes stock out, FEFO unless a lot is given. Refuses (StockError) rather than going
// negative: the caller's transaction rolls back and nothing is recorded.
export async function consumeStock(tx: Tx, input: ConsumeStockInput, lockedItem?: LockedItem): Promise<ConsumeResult> {
  const item = lockedItem ?? (await lockItem(tx, input.tenantId, input.itemId));
  // Expired stock may only leave as a loss, never to a patient.
  const allowExpired = input.type === "expired" || input.type === "damaged" || input.type === "lost";

  let locationId: string;
  if (input.lotId) {
    const lot = await tx.stockLot.findFirst({ where: { id: input.lotId, itemId: item.id }, select: { expiryDate: true, locationId: true } });
    if (!lot) throw new StockError("lot_not_found");
    if (!allowExpired && isExpired(lot.expiryDate, input.occurredAt)) throw new StockError("lot_expired");
    locationId = lot.locationId;
  } else {
    locationId = input.locationId ?? (await dispensingLocationId(tx, input.tenantId, item.storageLocationId));
  }

  const lots = await tx.stockLot.findMany({
    where: { itemId: item.id, locationId, quantity: { gt: 0 }, ...(input.lotId ? { id: input.lotId } : {}) },
    select: { id: true, lotNumber: true, expiryDate: true, quantity: true },
  });
  const plan = planFefo(lots, input.quantity, input.occurredAt, { allowExpired });
  if (!plan.ok) throw new StockError("insufficient_stock", { available: plan.available, itemName: item.name });

  let balance = item.stock;
  const movements: Prisma.StockMovementCreateManyInput[] = [];
  for (const allocation of plan.allocations) {
    await tx.stockLot.update({ where: { id: allocation.lotId }, data: { quantity: { decrement: allocation.quantity } } });
    balance -= allocation.quantity;
    movements.push({
      tenantId: input.tenantId,
      itemId: item.id,
      lotId: allocation.lotId,
      locationId,
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
  await rebalanceIfBackdated(tx, item.id, input.occurredAt);
  item.stock = balance;

  const lotsById = new Map(lots.map((lot) => [lot.id, lot]));
  return {
    allocations: plan.allocations.map((a) => ({ ...a, lotNumber: lotsById.get(a.lotId)!.lotNumber, expiryDate: lotsById.get(a.lotId)!.expiryDate })),
    balanceAfter: balance,
  };
}

// ── Transfer between depots ─────────────────────────────────────────────────

export interface TransferStockInput extends Actor {
  itemId: string;
  lotId: string;
  toLocationId: string;
  quantity: number;
  reason?: string | null;
  occurredAt: Date;
}

// Moves quantity of one lot to the same lot number in another depot (created if needed).
// The article's total does not change: one transfer_out and one transfer_in movement.
export async function transferStock(tx: Tx, input: TransferStockInput) {
  const item = await lockItem(tx, input.tenantId, input.itemId);
  const lot = await tx.stockLot.findFirst({ where: { id: input.lotId, itemId: item.id } });
  if (!lot) throw new StockError("lot_not_found");
  if (lot.locationId === input.toLocationId) throw new StockError("same_location");
  if (lot.quantity < input.quantity) throw new StockError("insufficient_stock", { available: lot.quantity, itemName: item.name });

  await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: { decrement: input.quantity } } });
  const destination = await tx.stockLot.upsert({
    where: { itemId_lotNumber_locationId: { itemId: item.id, lotNumber: lot.lotNumber, locationId: input.toLocationId } },
    update: { quantity: { increment: input.quantity } },
    create: {
      tenantId: input.tenantId,
      itemId: item.id,
      locationId: input.toLocationId,
      lotNumber: lot.lotNumber,
      expiryDate: lot.expiryDate,
      quantity: input.quantity,
      receivedAt: input.occurredAt,
    },
  });
  const common = { tenantId: input.tenantId, itemId: item.id, reason: input.reason ?? null, occurredAt: input.occurredAt, recordedById: input.userId };
  await tx.stockMovement.createMany({
    data: [
      { ...common, lotId: lot.id, locationId: lot.locationId, type: "transfer_out", quantity: -input.quantity, balanceAfter: item.stock - input.quantity, sourceType: "stock_transfer", sourceId: destination.id },
      { ...common, lotId: destination.id, locationId: input.toLocationId, type: "transfer_in", quantity: input.quantity, balanceAfter: item.stock, sourceType: "stock_transfer", sourceId: lot.id },
    ],
  });
  await rebalanceIfBackdated(tx, item.id, input.occurredAt);
  return destination;
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
      locationId: lot.locationId,
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
