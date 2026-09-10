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
    const existing = await prisma.examCatalogType.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Exam type not found" }, { status: 404 });

    const body = await request.json();
    const { code, nameFr, nameEn, order, isActive } = body as {
      code?: string; nameFr?: string; nameEn?: string; order?: number; isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (nameFr !== undefined) data.nameFr = nameFr.trim();
    if (nameEn !== undefined) data.nameEn = nameEn?.trim() || null;
    if (order !== undefined) data.order = order;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.examCatalogType.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/settings/exam-types/[id]]", error);
    return NextResponse.json({ error: "Failed to update exam type" }, { status: 400 });
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
  const existing = await prisma.examCatalogType.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Exam type not found" }, { status: 404 });

  const entryCount = await prisma.examCatalogEntry.count({ where: { examTypeId: id } });
  if (entryCount > 0) {
    return NextResponse.json({ error: "Cannot delete an exam type that still has exams" }, { status: 400 });
  }

  await prisma.examCatalogType.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
