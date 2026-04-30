import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const inventory = await prisma.medicationInventory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      data: inventory,
      total: inventory.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/pharmacy/inventory]", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory", success: false },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, manufacturer, category, stock, threshold, unit, unitPrice } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required", success: false },
        { status: 400 }
      );
    }

    const item = await prisma.medicationInventory.create({
      data: {
        name,
        manufacturer: manufacturer || null,
        category: category || null,
        stock: stock ? parseInt(stock) : 0,
        threshold: threshold ? parseInt(threshold) : 0,
        unit: unit || null,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
      }
    });

    return NextResponse.json({ data: item, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/pharmacy/inventory]", error);
    return NextResponse.json(
      { error: "Failed to create inventory item", success: false },
      { status: 500 }
    );
  }
}
