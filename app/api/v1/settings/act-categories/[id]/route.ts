import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parseIncomeRubric } from "@/lib/reports/rma3-income";

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
    const existing = await prisma.medicalActCategory.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const body = await request.json();
    const { code, nameFr, nameEn, color, order, isActive, rma3IncomeRubric } = body as {
      code?: string; nameFr?: string; nameEn?: string; color?: string; order?: number; isActive?: boolean; rma3IncomeRubric?: unknown;
    };

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (nameFr !== undefined) data.nameFr = nameFr.trim();
    if (nameEn !== undefined) data.nameEn = nameEn?.trim() || null;
    if (color !== undefined) data.color = color || null;
    if (order !== undefined) data.order = order;
    if (isActive !== undefined) data.isActive = isActive;
    if (rma3IncomeRubric !== undefined) {
      const rubric = parseIncomeRubric(rma3IncomeRubric);
      if (rubric === "invalid") return NextResponse.json({ error: "invalid_rma3_rubric", code: "invalid_rma3_rubric" }, { status: 400 });
      data.rma3IncomeRubric = rubric;
    }

    const updated = await prisma.medicalActCategory.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/settings/act-categories/[id]]", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 400 });
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
  const existing = await prisma.medicalActCategory.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const actCount = await prisma.medicalAct.count({ where: { categoryId: id } });
  if (actCount > 0) {
    return NextResponse.json({ error: "Cannot delete a category that still has medical acts" }, { status: 400 });
  }

  await prisma.medicalActCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
