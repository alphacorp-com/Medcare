import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { isExpired } from "@/lib/stock/fefo";

// Lots expiring within this many days are flagged on the dashboard.
const EXPIRY_ALERT_DAYS = 30;
const DAY_MS = 86_400_000;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same inventory data as GET /pharmacy/inventory, so the same module gate applies.
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
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

    // Lots still on the shelf that are expired or expire within EXPIRY_ALERT_DAYS, all depots.
    // Same expiry rule as the stock (lib/stock/fefo): usable on its expiry date, expired after.
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const expiringLots = !session.user.tenantId ? [] : await prisma.stockLot.findMany({
      where: {
        tenantId: session.user.tenantId,
        quantity: { gt: 0 },
        expiryDate: { not: null, lte: new Date(today + EXPIRY_ALERT_DAYS * DAY_MS) },
        item: { isActive: true },
      },
      include: { item: { select: { name: true, unit: true } } },
      orderBy: { expiryDate: "asc" },
      take: 10,
    });

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
      ...expiringLots.map((lot) => {
        const expired = isExpired(lot.expiryDate, now);
        const daysUntilExpiry = Math.round((lot.expiryDate!.getTime() - today) / DAY_MS);
        return {
          id: `expiring-${lot.id}`,
          type: 'expiring' as const,
          medication: lot.item.name,
          unit: lot.item.unit || 'units',
          expiryDate: lot.expiryDate!.toISOString(),
          daysUntilExpiry: Math.max(0, daysUntilExpiry),
          severity: expired ? 'critical' : 'warning',
          message: expired
            ? `Lot ${lot.lotNumber} expired — ${lot.quantity} ${lot.item.unit || 'units'} to record as a loss`
            : `Lot ${lot.lotNumber}: ${lot.quantity} ${lot.item.unit || 'units'} expiring`,
        };
      }),
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