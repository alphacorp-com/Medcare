import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { RESOURCE_ACCESS_DENIED } from "@/lib/permissions";

// GET /api/v1/users/[id]/activity — audit trail for a single user: actions they took
// (logins, mutations elsewhere) and actions taken on them (an admin editing their role/modules).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSelf = session.user.id === id;

    if (!isSelf) {
      // An administrator may only view activity for users in their OWN tenant — being
      // an admin alone doesn't imply access to another tenant's users.
      if (!session.user.isSystemAdmin) {
        return NextResponse.json({ error: RESOURCE_ACCESS_DENIED }, { status: 403 });
      }
      const targetUser = await prisma.tenantUser.findUnique({
        where: { id },
        select: { tenantId: true },
      });
      // Same response for "not found" and "different tenant" so this endpoint can't be used
      // to probe whether a given user id exists in another tenant.
      if (!targetUser || targetUser.tenantId !== session.user.tenantId) {
        return NextResponse.json({ error: RESOURCE_ACCESS_DENIED }, { status: 403 });
      }
    }

    // Scoped to the caller's tenant as well: AuditLog is platform-wide, and the access check
    // above is about the target user, not about which tenant's rows get read.
    const entries = await prisma.auditLog.findMany({
      where: {
        tenantId: session.user.tenantId,
        OR: [
          { actorId: id },
          { resourceType: "tenant_user", resourceId: id },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const actorIds = Array.from(new Set(entries.map((e) => e.actorId)));
    const tenantActors = await prisma.tenantUser.findMany({
      where: { id: { in: actorIds }, tenantId: session.user.tenantId },
      select: { id: true, fullName: true },
    });
    const actorNames = new Map<string, string>();
    for (const actor of tenantActors) {
      actorNames.set(actor.id, actor.fullName);
    }

    const activities = entries.map((entry) => ({
      id: entry.id,
      timestamp: entry.createdAt.toISOString(),
      action: entry.action,
      resourceType: entry.resourceType,
      actorId: entry.actorId,
      actorType: entry.actorType,
      // Null when there's no name to show (system actor, deleted user) — the page
      // translates the fallback. Codes and structured payload only; the page formats them.
      actorName: actorNames.get(entry.actorId) ?? null,
      isSelf: entry.actorId === id,
      payload: entry.payload,
      ipAddress: entry.ipAddress,
    }));

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching user activity:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
