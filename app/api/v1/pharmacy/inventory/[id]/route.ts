import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { parseItemFields } from "@/lib/stock/input";
import { checkItemReferences } from "@/lib/stock/item-references";

// ── PATCH /api/v1/pharmacy/inventory/:id ────────────────────────────────────
// Updates the article's settings. `stock` is refused (400 stock_is_read_only): it only
// changes through receipts, losses, counts, dispensings and vaccinations.
export async function PATCH(
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
    const { id } = await params;

    const existingItem = await prisma.medicationInventory.findFirst({ where: { id, tenantId } });
    if (!existingItem) {
      return NextResponse.json({ error: "Inventory item not found", success: false }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body", success: false }, { status: 400 });
    }
    // The edit form sends the whole row back: ignore the read-only stock when unchanged.
    const raw = { ...(body as Record<string, unknown>) };
    if (raw.stock !== undefined && Number(raw.stock) === existingItem.stock) delete raw.stock;
    for (const key of ["id", "tenantId", "isActive", "createdAt", "updatedAt", "expiredQuantity", "expiringSoonQuantity", "nearestExpiry"]) delete raw[key];

    const parsed = parseItemFields(raw, { partial: true });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: parsed.error, success: false }, { status: 400 });
    }
    const referenceError = await checkItemReferences(tenantId, parsed.value);
    if (referenceError) {
      return NextResponse.json({ error: referenceError, code: referenceError, success: false }, { status: 400 });
    }

    const item = await prisma.medicationInventory.update({ where: { id: existingItem.id }, data: parsed.value });

    const changed = Object.fromEntries(
      Object.entries(parsed.value).filter(([key, value]) => String(existingItem[key as keyof typeof existingItem] ?? "") !== String(value ?? ""))
    );
    if (Object.keys(changed).length > 0) {
      await recordAuditEvent({
        tenantId,
        actorId: session.user.id,
        actorType: "tenant_user",
        action: "inventory_item.update",
        resourceType: "medication_inventory",
        resourceId: item.id,
        payload: { name: item.name, changed },
        ...extractRequestMeta(request.headers),
      });
    }

    return NextResponse.json({ data: item, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/pharmacy/inventory/[id]]", error);
    return NextResponse.json({ error: "Failed to update inventory item", success: false }, { status: 500 });
  }
}
