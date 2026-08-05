import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

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
    const isPlatformAdmin = session.user.role === "admin";

    if (!isSelf && !isPlatformAdmin) {
      // A tenant_admin may only view activity for users in their OWN tenant — being
      // "tenant_admin" alone doesn't imply access to another tenant's users.
      if (session.user.role !== "tenant_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const targetUser = await prisma.tenantUser.findUnique({
        where: { id },
        select: { tenantId: true },
      });
      // Same response for "not found" and "different tenant" so this endpoint can't be used
      // to probe whether a given user id exists in another tenant.
      if (!targetUser || targetUser.tenantId !== session.user.tenantId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const entries = await prisma.auditLog.findMany({
      where: {
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
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true, email: true },
    });
    const adminActors = await prisma.adminUser.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true, email: true },
    });
    const actorNames = new Map<string, string>();
    for (const actor of [...tenantActors, ...adminActors]) {
      actorNames.set(actor.id, actor.fullName);
    }

    const activities = entries.map((entry) => ({
      id: entry.id,
      timestamp: entry.createdAt.toISOString(),
      action: entry.action,
      resourceType: entry.resourceType,
      actorId: entry.actorId,
      actorName: actorNames.get(entry.actorId) ?? "System",
      isSelf: entry.actorId === id,
      details: entry.payload ? JSON.stringify(entry.payload) : null,
      ipAddress: entry.ipAddress,
    }));

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching user activity:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
