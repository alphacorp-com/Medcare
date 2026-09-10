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
    const existing = await prisma.medicalAct.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Medical act not found" }, { status: 404 });

    const body = await request.json();
    const {
      categoryId, code, nameFr, nameEn, basePrice, unit,
      defaultPecCoveragePercent, allowsUrgencySurcharge, requiresLabValidation, isActive,
    } = body as {
      categoryId?: string; code?: string; nameFr?: string; nameEn?: string;
      basePrice?: number | string; unit?: string;
      defaultPecCoveragePercent?: number; allowsUrgencySurcharge?: boolean; requiresLabValidation?: boolean; isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (nameFr !== undefined) data.nameFr = nameFr.trim();
    if (nameEn !== undefined) data.nameEn = nameEn?.trim() || null;
    if (basePrice !== undefined) {
      const price = Number(basePrice);
      if (Number.isNaN(price) || price < 0) {
        return NextResponse.json({ error: "basePrice must be a non-negative number" }, { status: 400 });
      }
      data.basePrice = price;
    }
    if (unit !== undefined) data.unit = unit?.trim() || null;
    if (defaultPecCoveragePercent !== undefined) data.defaultPecCoveragePercent = defaultPecCoveragePercent;
    if (allowsUrgencySurcharge !== undefined) data.allowsUrgencySurcharge = allowsUrgencySurcharge;
    if (requiresLabValidation !== undefined) data.requiresLabValidation = requiresLabValidation;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.medicalAct.update({
      where: { id },
      data,
      include: { category: { select: { id: true, nameFr: true, nameEn: true, color: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/settings/medical-acts/[id]]", error);
    return NextResponse.json({ error: "Failed to update medical act" }, { status: 400 });
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
  const existing = await prisma.medicalAct.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Medical act not found" }, { status: 404 });

  await prisma.medicalAct.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
