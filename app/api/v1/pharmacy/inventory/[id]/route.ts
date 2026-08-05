import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

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

    const { id } = await params;

    const existingItem = await prisma.medicationInventory.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existingItem) {
      return NextResponse.json(
        { error: "Inventory item not found", success: false },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Fields that can be updated
    const { name, manufacturer, category, stock, threshold, unit, unitPrice } = body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (manufacturer !== undefined) dataToUpdate.manufacturer = manufacturer;
    if (category !== undefined) dataToUpdate.category = category;
    if (stock !== undefined) dataToUpdate.stock = parseInt(stock);
    if (threshold !== undefined) dataToUpdate.threshold = parseInt(threshold);
    if (unit !== undefined) dataToUpdate.unit = unit;
    if (unitPrice !== undefined) dataToUpdate.unitPrice = unitPrice ? parseFloat(unitPrice) : null;

    const item = await prisma.medicationInventory.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ data: item, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/pharmacy/inventory/[id]]", error);
    return NextResponse.json(
      { error: "Failed to update inventory item", success: false },
      { status: 500 }
    );
  }
}
