import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get medications with low stock (below threshold)
    const lowStockMedications = await prisma.medicationInventory.findMany({
      where: {
        tenantId: session.user.tenantId,
        stock: {
          lte: prisma.medicationInventory.fields.threshold,
        },
        isActive: true,
      },
      orderBy: {
        stock: 'asc',
      },
      take: 10, // Limit to 10 for dashboard
    });

    // For now, skip expiring medications as the schema doesn't have expiry dates
    const alerts = [
      ...lowStockMedications.map((item) => ({
        id: `low-stock-${item.id}`,
        type: 'low_stock' as const,
        medication: item.name,
        currentStock: item.stock,
        reorderPoint: item.threshold,
        unit: item.unit || 'units',
        severity: item.stock === 0 ? 'critical' : 'warning',
        message: item.stock === 0
          ? `Out of stock - ${item.name}`
          : `Low stock: ${item.stock} ${item.unit || 'units'} remaining`,
      })),
      // Add expiring medications logic here when expiry dates are added to schema
    ];

    // Sort by severity (critical first, then warning)
    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1 };
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    });

    return NextResponse.json({
      data: alerts.slice(0, 10), // Limit to 10 total alerts
      total: alerts.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/dashboard/stock-alerts]", error);
    return NextResponse.json(
      { error: "Failed to fetch stock alerts", success: false },
      { status: 500 }
    );
  }
}