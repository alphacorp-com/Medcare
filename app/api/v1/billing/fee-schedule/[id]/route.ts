import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// PATCH /api/v1/billing/fee-schedule/[id] — update label/price/active flag
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const existing = await prisma.feeSchedule.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Tariff not found" }, { status: 404 });

    const body = await request.json();
    const { label, unitPrice, isActive } = body as { label?: string; unitPrice?: number | string; isActive?: boolean };

    const data: { label?: string; unitPrice?: number; isActive?: boolean } = {};
    if (label !== undefined) data.label = label;
    if (unitPrice !== undefined) {
      const price = Number(unitPrice);
      if (Number.isNaN(price) || price < 0) {
        return NextResponse.json({ error: "unitPrice must be a non-negative number" }, { status: 400 });
      }
      data.unitPrice = price;
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.feeSchedule.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/billing/fee-schedule/[id]]", error);
    return NextResponse.json({ error: "Failed to update tariff" }, { status: 400 });
  }
}

// DELETE /api/v1/billing/fee-schedule/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_BILLING", "delete");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await params;
  const existing = await prisma.feeSchedule.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Tariff not found" }, { status: 404 });

  await prisma.feeSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
