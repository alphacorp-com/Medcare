import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const inventory = await prisma.medicationInventory.findMany({
      where: { isActive: true, tenantId: session.user.tenantId },
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const body = await request.json();
    const { name, manufacturer, category, stock, threshold, unit, unitPrice, storageLocationId, supplierId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required", success: false },
        { status: 400 }
      );
    }

    const item = await prisma.medicationInventory.create({
      data: {
        tenantId: session.user.tenantId,
        name,
        manufacturer: manufacturer || null,
        category: category || null,
        stock: stock ? parseInt(stock) : 0,
        threshold: threshold ? parseInt(threshold) : 0,
        unit: unit || null,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        storageLocationId: storageLocationId || null,
        supplierId: supplierId || null,
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
