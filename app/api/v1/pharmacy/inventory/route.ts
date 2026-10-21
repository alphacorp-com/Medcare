import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { isExpired } from "@/lib/stock/fefo";
import { parseItemFields } from "@/lib/stock/input";
import { checkItemReferences } from "@/lib/stock/item-references";
import { loadDispensableStock } from "@/lib/stock/availability";
import { ensureDefaultLocation } from "@/lib/stock/locations";

// Lots expiring within this many days are flagged in the inventory.
const EXPIRY_WARNING_DAYS = 90;

// ── GET /api/v1/pharmacy/inventory ──────────────────────────────────────────
// Active articles with, per article, the expired quantity still on the shelf, the quantity
// expiring within 90 days, the nearest expiry date of the usable lots and the dispensable
// stock (non-expired lots of the dispensing depot).
export async function GET() {
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

    const [inventory, lots] = await Promise.all([
      prisma.medicationInventory.findMany({
        where: { isActive: true, tenantId },
        orderBy: { name: "asc" },
      }),
      prisma.stockLot.findMany({
        where: { tenantId, quantity: { gt: 0 } },
        select: { itemId: true, expiryDate: true, quantity: true },
      }),
    ]);

    const now = new Date();
    const warnBefore = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);
    const summary = new Map<string, { expiredQuantity: number; expiringSoonQuantity: number; nearestExpiry: Date | null }>();
    for (const lot of lots) {
      const s = summary.get(lot.itemId) ?? { expiredQuantity: 0, expiringSoonQuantity: 0, nearestExpiry: null };
      if (isExpired(lot.expiryDate, now)) s.expiredQuantity += lot.quantity;
      else if (lot.expiryDate) {
        if (lot.expiryDate <= warnBefore) s.expiringSoonQuantity += lot.quantity;
        if (!s.nearestExpiry || lot.expiryDate < s.nearestExpiry) s.nearestExpiry = lot.expiryDate;
      }
      summary.set(lot.itemId, s);
    }

    const dispensable = await loadDispensableStock(tenantId, inventory, now);
    const data = inventory.map((item) => ({
      ...item,
      dispensableStock: dispensable.get(item.id) ?? 0,
      expiredQuantity: summary.get(item.id)?.expiredQuantity ?? 0,
      expiringSoonQuantity: summary.get(item.id)?.expiringSoonQuantity ?? 0,
      nearestExpiry: summary.get(item.id)?.nearestExpiry ?? null,
    }));

    return NextResponse.json({ data, total: data.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/pharmacy/inventory]", error);
    return NextResponse.json({ error: "Failed to fetch inventory", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/pharmacy/inventory ─────────────────────────────────────────
// Creates an article with an empty stock: quantities only arrive through a receipt
// (POST /api/v1/pharmacy/inventory/:id/movements), which records the lot and expiry.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body", success: false }, { status: 400 });
    }
    const parsed = parseItemFields(body as Record<string, unknown>, { partial: false });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: parsed.error, success: false }, { status: 400 });
    }
    const referenceError = await checkItemReferences(tenantId, parsed.value);
    if (referenceError) {
      return NextResponse.json({ error: referenceError, code: referenceError, success: false }, { status: 400 });
    }

    const { name, ...fields } = parsed.value;
    // Every article has a dispensing depot (the main one when none is chosen).
    const item = await prisma.$transaction(async (tx) =>
      tx.medicationInventory.create({
        data: { tenantId, name: name!, ...fields, storageLocationId: fields.storageLocationId ?? (await ensureDefaultLocation(tx, tenantId)), stock: 0 },
      })
    );

    await recordAuditEvent({
      tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "inventory_item.create",
      resourceType: "medication_inventory",
      resourceId: item.id,
      payload: { name: item.name },
      ...extractRequestMeta(request.headers),
    });

    return NextResponse.json({ data: item, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/pharmacy/inventory]", error);
    return NextResponse.json({ error: "Failed to create inventory item", success: false }, { status: 500 });
  }
}
