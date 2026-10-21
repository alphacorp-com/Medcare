import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { isExpired } from "@/lib/stock/fefo";
import { parseCount, parseLoss, parseReceipt, parseTransfer } from "@/lib/stock/input";
import { StockError, consumeStock, countLot, receiveStock, stockErrorResponse, transferStock } from "@/lib/stock/movements";

// A depot id from the browser must be one of this tenant's active storage locations.
async function isTenantLocation(tenantId: string, locationId: string | null): Promise<boolean> {
  if (!locationId) return true;
  const location = await prisma.storageLocation.findFirst({ where: { id: locationId, tenantId, isActive: true }, select: { id: true } });
  return Boolean(location);
}

// ── GET /api/v1/pharmacy/inventory/:id/movements?page=&pageSize= ───────────
// The article's lots still in stock per depot (FEFO order, expired ones flagged), its open
// multi-dose vials and its stock journal, most recent first, paged.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
    }
    const { id } = await params;

    const item = await prisma.medicationInventory.findFirst({ where: { id, tenantId }, select: { id: true, storageLocationId: true } });
    if (!item) {
      return NextResponse.json({ error: "Inventory item not found", success: false }, { status: 404 });
    }

    const { page, pageSize, skip } = parsePagination(new URL(request.url).searchParams);
    const now = new Date();
    const [lots, movements, total, openVials] = await Promise.all([
      prisma.stockLot.findMany({
        where: { itemId: id, tenantId, quantity: { gt: 0 } },
        orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { lotNumber: "asc" }],
        select: { id: true, lotNumber: true, expiryDate: true, quantity: true, receivedAt: true, location: { select: { id: true, name: true } } },
      }),
      prisma.stockMovement.findMany({
        where: { itemId: id, tenantId },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: { lot: { select: { lotNumber: true } }, location: { select: { name: true } } },
      }),
      prisma.stockMovement.count({ where: { itemId: id, tenantId } }),
      prisma.stockOpenVial.findMany({
        where: { itemId: id, tenantId, closedAt: null, discardAt: { gt: now } },
        orderBy: { openedAt: "asc" },
        select: { id: true, dosesPerVial: true, dosesUsed: true, openedAt: true, discardAt: true, lot: { select: { lotNumber: true } } },
      }),
    ]);

    const userIds = [...new Set(movements.map((m) => m.recordedById))];
    const users = await prisma.tenantUser.findMany({
      where: { tenantId, id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const userNames = new Map(users.map((u) => [u.id, u.fullName]));

    return NextResponse.json({
      dispensingLocationId: item.storageLocationId,
      lots: lots.map(({ location, ...lot }) => ({ ...lot, locationId: location.id, locationName: location.name, isExpired: isExpired(lot.expiryDate, now) })),
      openVials: openVials.map(({ lot, ...vial }) => ({ ...vial, lotNumber: lot.lotNumber, dosesLeft: vial.dosesPerVial - vial.dosesUsed })),
      data: movements.map(({ lot, location, ...m }) => ({
        ...m,
        unitCost: m.unitCost === null ? null : Number(m.unitCost),
        lotNumber: lot?.lotNumber ?? null,
        locationName: location.name,
        recordedByName: userNames.get(m.recordedById) ?? null,
      })),
      total,
      page,
      pageSize,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/pharmacy/inventory/:id/movements]", error);
    return NextResponse.json({ error: "Failed to fetch stock movements", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/pharmacy/inventory/:id/movements ───────────────────────────
// Body: { kind: "receipt", locationId?, lotNumber, expiryDate?, quantity, unitCost?, supplierId?, reason?, occurredAt? }
//     | { kind: "loss", type: "expired"|"damaged"|"lost", lotId? | locationId?, quantity, reason, occurredAt? }
//     | { kind: "transfer", lotId, toLocationId, quantity, reason?, occurredAt? }
//     | { kind: "count", lotId, countedQuantity, reason }
// locationId defaults to the article's dispensing depot.
// Every quantity is validated server-side and applied by lib/stock in one transaction.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
    }
    const actor = { tenantId, userId: session.user.id };
    const { id: itemId } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body", success: false }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const invalid = (code: string) => NextResponse.json({ error: code, code, success: false }, { status: 400 });

    try {
      if (input.kind === "receipt") {
        const parsed = parseReceipt(input);
        if (!parsed.ok) return invalid(parsed.error);
        if (parsed.value.supplierId) {
          const supplier = await prisma.supplier.findFirst({ where: { id: parsed.value.supplierId, tenantId }, select: { id: true } });
          if (!supplier) return invalid("unknown_supplier");
        }
        if (!(await isTenantLocation(tenantId, parsed.value.locationId))) return invalid("unknown_storage_location");
        const movement = await prisma.$transaction((tx) => receiveStock(tx, { ...actor, itemId, ...parsed.value }));
        return NextResponse.json({ data: movement, success: true }, { status: 201 });
      }
      if (input.kind === "loss") {
        const parsed = parseLoss(input);
        if (!parsed.ok) return invalid(parsed.error);
        if (!(await isTenantLocation(tenantId, parsed.value.locationId))) return invalid("unknown_storage_location");
        const result = await prisma.$transaction((tx) =>
          consumeStock(tx, { ...actor, itemId, ...parsed.value, sourceType: "stock_loss" })
        );
        return NextResponse.json({ data: result, success: true }, { status: 201 });
      }
      if (input.kind === "transfer") {
        const parsed = parseTransfer(input);
        if (!parsed.ok) return invalid(parsed.error);
        if (!(await isTenantLocation(tenantId, parsed.value.toLocationId))) return invalid("unknown_storage_location");
        const lot = await prisma.$transaction((tx) => transferStock(tx, { ...actor, itemId, ...parsed.value }));
        return NextResponse.json({ data: lot, success: true }, { status: 201 });
      }
      if (input.kind === "count") {
        const parsed = parseCount(input);
        if (!parsed.ok) return invalid(parsed.error);
        const movement = await prisma.$transaction((tx) => countLot(tx, { ...actor, itemId, ...parsed.value }));
        return NextResponse.json({ data: movement, success: true }, { status: movement ? 201 : 200 });
      }
      return invalid("invalid_kind");
    } catch (error) {
      if (error instanceof StockError) {
        const { status, body: errorBody } = stockErrorResponse(error);
        return NextResponse.json(errorBody, { status });
      }
      throw error;
    }
  } catch (error) {
    console.error("[POST /api/v1/pharmacy/inventory/:id/movements]", error);
    return NextResponse.json({ error: "Failed to record stock movement", success: false }, { status: 500 });
  }
}
