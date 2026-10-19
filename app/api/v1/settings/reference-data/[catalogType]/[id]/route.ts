import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
  deactivateRoomTypeDailyPrice,
  getRoomTypeDailyPrice,
  parseDailyPrice,
  setRoomTypeDailyPrice,
} from "@/lib/billing/roomPricing";

// PATCH /api/v1/settings/reference-data/[catalogType]/[id] — edit or toggle active
export async function PATCH(request: Request, { params }: { params: Promise<{ catalogType: string; id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const existing = await prisma.referenceCatalogItem.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const body = await request.json();
    const { code, nameFr, nameEn, color, icon, group, order, isActive, dailyPrice } = body as {
      code?: string;
      nameFr?: string;
      nameEn?: string;
      color?: string;
      icon?: string;
      group?: string;
      order?: number;
      isActive?: boolean;
      dailyPrice?: number | string | null;
    };
    const parsedPrice = parseDailyPrice(dailyPrice);
    if (!parsedPrice.ok) {
      return NextResponse.json({ error: "dailyPrice must be a non-negative number" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (nameFr !== undefined) data.nameFr = nameFr.trim();
    if (nameEn !== undefined) data.nameEn = nameEn?.trim() || null;
    if (color !== undefined) data.color = color || null;
    if (icon !== undefined) data.icon = icon || null;
    if (group !== undefined) data.group = group || null;
    if (order !== undefined) data.order = order;
    if (isActive !== undefined) data.isActive = isActive;

    const tenantId = session.user.tenantId;
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.referenceCatalogItem.update({ where: { id }, data });
      if (existing.catalogType !== "room_type") return item;

      // The daily price is keyed on the room type code: a renamed code takes its price along
      // (unless a new one is given), and the old code stops being billable.
      const codeChanged = item.code !== existing.code;
      const price =
        parsedPrice.price !== undefined
          ? parsedPrice.price
          : codeChanged
          ? await getRoomTypeDailyPrice(tx, tenantId, existing.code)
          : undefined;
      if (codeChanged) await deactivateRoomTypeDailyPrice(tx, tenantId, existing.code);
      if (price !== undefined) {
        await setRoomTypeDailyPrice(tx, { tenantId, code: item.code, label: item.nameFr, price });
      } else if (item.nameFr !== existing.nameFr) {
        await tx.feeSchedule.updateMany({ where: { tenantId, sourceType: "hospitalization", code: item.code }, data: { label: item.nameFr } });
      }
      return item;
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/settings/reference-data/[catalogType]/[id]]", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 400 });
  }
}

// DELETE /api/v1/settings/reference-data/[catalogType]/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ catalogType: string; id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await params;
  const existing = await prisma.referenceCatalogItem.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.referenceCatalogItem.delete({ where: { id } });
    if (existing.catalogType === "room_type") {
      await deactivateRoomTypeDailyPrice(tx, session.user.tenantId, existing.code);
    }
  });
  return NextResponse.json({ success: true });
}
