import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

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
    const { code, nameFr, nameEn, color, icon, group, order, isActive } = body as {
      code?: string;
      nameFr?: string;
      nameEn?: string;
      color?: string;
      icon?: string;
      group?: string;
      order?: number;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (nameFr !== undefined) data.nameFr = nameFr.trim();
    if (nameEn !== undefined) data.nameEn = nameEn?.trim() || null;
    if (color !== undefined) data.color = color || null;
    if (icon !== undefined) data.icon = icon || null;
    if (group !== undefined) data.group = group || null;
    if (order !== undefined) data.order = order;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.referenceCatalogItem.update({ where: { id }, data });
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

  await prisma.referenceCatalogItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
