import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Fields that can be updated
    const { name, manufacturer, category, stock, threshold, unit } = body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (manufacturer !== undefined) dataToUpdate.manufacturer = manufacturer;
    if (category !== undefined) dataToUpdate.category = category;
    if (stock !== undefined) dataToUpdate.stock = parseInt(stock);
    if (threshold !== undefined) dataToUpdate.threshold = parseInt(threshold);
    if (unit !== undefined) dataToUpdate.unit = unit;

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
