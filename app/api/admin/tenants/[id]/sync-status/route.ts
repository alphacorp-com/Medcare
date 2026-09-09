import { NextRequest, NextResponse } from "next/server";
import { syncTenantStatus } from "@/lib/subscription-sync";
import prisma from "@/lib/prisma";
import { requireAdminOrServiceAuth } from "@/lib/admin/service-auth";

/**
 * POST /api/admin/tenants/[id]/sync-status
 * Manually sync a tenant's status based on their subscription status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrServiceAuth(request);

    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: tenantId } = await params;

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Sync tenant status
    await syncTenantStatus(tenantId);

    // Fetch updated tenant
    const updatedTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      message: "Tenant status synced successfully",
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error("Error syncing tenant status:", error);
    return NextResponse.json(
      { error: "Failed to sync tenant status" },
      { status: 500 }
    );
  }
}
