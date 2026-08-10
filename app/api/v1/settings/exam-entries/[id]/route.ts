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
    const existing = await prisma.examCatalogEntry.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const body = await request.json();
    const {
      code, nameFr, nameEn, price, parameters,
      imagingCatalogItemId, anatomicalZoneId, requiresContrast, isActive,
    } = body as {
      code?: string; nameFr?: string; nameEn?: string; price?: number | string | null;
      parameters?: { name: string; unit: string; referenceRange: string }[];
      imagingCatalogItemId?: string | null; anatomicalZoneId?: string | null; requiresContrast?: boolean | null; isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (nameFr !== undefined) data.nameFr = nameFr.trim();
    if (nameEn !== undefined) data.nameEn = nameEn?.trim() || null;
    if (price !== undefined) data.price = price === null || price === "" ? null : Number(price);
    if (parameters !== undefined) data.parameters = parameters;
    if (imagingCatalogItemId !== undefined) data.imagingCatalogItemId = imagingCatalogItemId || null;
    if (anatomicalZoneId !== undefined) data.anatomicalZoneId = anatomicalZoneId || null;
    if (requiresContrast !== undefined) data.requiresContrast = requiresContrast;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.examCatalogEntry.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/settings/exam-entries/[id]]", error);
    return NextResponse.json({ error: "Failed to update exam" }, { status: 400 });
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
  const existing = await prisma.examCatalogEntry.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  await prisma.examCatalogEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
