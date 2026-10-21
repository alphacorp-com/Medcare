import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { isExpired } from "@/lib/stock/fefo";
import { parseCount, parseLoss, parseReceipt } from "@/lib/stock/input";
import { StockError, consumeStock, countLot, receiveStock, stockErrorResponse } from "@/lib/stock/movements";

// ── GET /api/v1/pharmacy/inventory/:id/movements?page=&pageSize= ───────────
// The article's lots still in stock (FEFO order, expired ones flagged) and its stock
// journal, most recent first, paged.
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

    const item = await prisma.medicationInventory.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!item) {
      return NextResponse.json({ error: "Inventory item not found", success: false }, { status: 404 });
    }

    const { page, pageSize, skip } = parsePagination(new URL(request.url).searchParams);
    const [lots, movements, total] = await Promise.all([
      prisma.stockLot.findMany({
        where: { itemId: id, tenantId, quantity: { gt: 0 } },
        orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { lotNumber: "asc" }],
        select: { id: true, lotNumber: true, expiryDate: true, quantity: true, receivedAt: true },
      }),
      prisma.stockMovement.findMany({
        where: { itemId: id, tenantId },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: { lot: { select: { lotNumber: true } } },
      }),
      prisma.stockMovement.count({ where: { itemId: id, tenantId } }),
    ]);

    const userIds = [...new Set(movements.map((m) => m.recordedById))];
    const users = await prisma.tenantUser.findMany({
      where: { tenantId, id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const userNames = new Map(users.map((u) => [u.id, u.fullName]));

    const now = new Date();
    return NextResponse.json({
      lots: lots.map((lot) => ({ ...lot, isExpired: isExpired(lot.expiryDate, now) })),
      data: movements.map(({ lot, ...m }) => ({
        ...m,
        unitCost: m.unitCost === null ? null : Number(m.unitCost),
        lotNumber: lot?.lotNumber ?? null,
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
// Body: { kind: "receipt", lotNumber, expiryDate?, quantity, unitCost?, supplierId?, reason?, occurredAt? }
//     | { kind: "loss", type: "expired"|"damaged"|"lost", lotId?, quantity, reason, occurredAt? }
//     | { kind: "count", lotId, countedQuantity, reason }
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
        const movement = await prisma.$transaction((tx) => receiveStock(tx, { ...actor, itemId, ...parsed.value }));
        return NextResponse.json({ data: movement, success: true }, { status: 201 });
      }
      if (input.kind === "loss") {
        const parsed = parseLoss(input);
        if (!parsed.ok) return invalid(parsed.error);
        const result = await prisma.$transaction((tx) =>
          consumeStock(tx, { ...actor, itemId, ...parsed.value, sourceType: "stock_loss" })
        );
        return NextResponse.json({ data: result, success: true }, { status: 201 });
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
