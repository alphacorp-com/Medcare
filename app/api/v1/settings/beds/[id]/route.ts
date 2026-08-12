import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { Prisma, type BedStatus } from "@prisma/client";

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
    const existing = await prisma.bed.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Bed not found" }, { status: 404 });

    const body = await request.json();
    const { code, label, departmentId, roomTypeId, status, isActive } = body as {
      code?: string; label?: string; departmentId?: string; roomTypeId?: string | null;
      status?: BedStatus; isActive?: boolean;
    };

    // The admission/transfer/discharge flow is the only thing allowed to move a
    // bed in/out of "occupied" (it always clears currentStayId on release) — this
    // route can only manage inventory fields and manual maintenance/reserved toggles.
    if (existing.currentStayId) {
      return NextResponse.json(
        { error: "This bed is occupied — discharge or transfer the patient first" },
        { status: 409 }
      );
    }
    if (status === "occupied") {
      return NextResponse.json({ error: "Bed status can only become occupied through an admission" }, { status: 400 });
    }

    if (departmentId !== undefined) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, tenantId: session.user.tenantId },
        select: { id: true },
      });
      if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (label !== undefined) data.label = label.trim();
    if (departmentId !== undefined) data.departmentId = departmentId;
    if (roomTypeId !== undefined) data.roomTypeId = roomTypeId || null;
    if (status !== undefined) data.status = status;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.bed.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A bed with this code already exists" }, { status: 409 });
    }
    console.error("[PATCH /api/v1/settings/beds/[id]]", error);
    return NextResponse.json({ error: "Failed to update bed" }, { status: 400 });
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
  const existing = await prisma.bed.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Bed not found" }, { status: 404 });

  if (existing.currentStayId || existing.status === "occupied") {
    return NextResponse.json({ error: "This bed is occupied and cannot be deleted" }, { status: 409 });
  }

  await prisma.bed.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
