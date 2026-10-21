import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // This feed spans every staff member's activity in the tenant — restricted to
    // tenant_admin for the same reason users/[id]/activity restricts a user's own
    // activity history to admins-or-self.
    const permissionCheck = requireTenantAdmin(session);
    if (!permissionCheck.ok) {
      return NextResponse.json({ error: permissionCheck.error }, { status: permissionCheck.status });
    }

    // Get recent audit activities (last 24 hours), scoped to the caller's own tenant —
    // AuditLog is a platform-wide table, so this filter is what keeps one tenant's activity
    // feed from leaking another tenant's logins/edits.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activities = await prisma.auditLog.findMany({
      where: {
        tenantId: session.user.tenantId,
        createdAt: { gte: yesterday },
      },
      select: { id: true, createdAt: true, actorId: true, actorType: true, action: true, resourceType: true, payload: true },
      orderBy: { createdAt: "desc" },
      take: 20, // Limit to 20 for dashboard
    });

    // Resolve actor names in one query. Only tenant_user actors have a name to show:
    // 'system' rows (e.g. failed logins) have no actor, and 'admin' rows come from the
    // decommissioned cross-tenant console, whose AdminUser table no longer exists.
    const actorIds = [...new Set(activities.filter((a) => a.actorType === "tenant_user").map((a) => a.actorId))];
    const actors = await prisma.tenantUser.findMany({
      where: { id: { in: actorIds }, tenantId: session.user.tenantId },
      select: { id: true, fullName: true },
    });
    const actorNames = new Map(actors.map((a) => [a.id, a.fullName]));

    // Codes and nulls only — the card translates them. The raw payload and IP address
    // aren't displayed on the dashboard, so they aren't sent either.
    const auditData = activities.map((activity) => ({
      id: activity.id,
      timestamp: activity.createdAt.toISOString(),
      user: actorNames.get(activity.actorId) ?? null,
      actorType: activity.actorType,
      action: activity.action,
      resourceType: activity.resourceType,
      severity: (activity.payload as unknown as { severity?: string } | null)?.severity ?? "low",
    }));

    return NextResponse.json({
      data: auditData,
      total: auditData.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/dashboard/audit]", error);
    return NextResponse.json(
      { error: "Failed to fetch audit activities", success: false },
      { status: 500 }
    );
  }
}
