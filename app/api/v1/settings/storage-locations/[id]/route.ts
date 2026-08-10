import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const existing = await prisma.storageLocation.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Location not found" }, { status: 404 });

    const body = await request.json();
    const { code, name, address, isActive } = body as { code?: string; name?: string; address?: string; isActive?: boolean };

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (name !== undefined) data.name = name.trim();
    if (address !== undefined) data.address = address?.trim() || null;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.storageLocation.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/settings/storage-locations/[id]]", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await params;
  const existing = await prisma.storageLocation.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  await prisma.storageLocation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
