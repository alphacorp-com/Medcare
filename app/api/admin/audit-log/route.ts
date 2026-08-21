import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { SYSTEM_ACTOR_ID } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const params = request.nextUrl.searchParams;
    const action = params.get("action");
    const tenantId = params.get("tenantId");
    const actorEmail = params.get("actorEmail");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const page = Math.max(1, Number(params.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 50));

    let actorIds: string[] | undefined;
    if (actorEmail) {
      const [admins, tenantUsers] = await Promise.all([
        prisma.adminUser.findMany({ where: { email: { contains: actorEmail, mode: "insensitive" } }, select: { id: true } }),
        prisma.tenantUser.findMany({ where: { email: { contains: actorEmail, mode: "insensitive" } }, select: { id: true } }),
      ]);
      actorIds = [...admins.map((a) => a.id), ...tenantUsers.map((u) => u.id)];
      if (actorIds.length === 0) {
        return NextResponse.json({ events: [], total: 0, page, limit });
      }
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action: { startsWith: action } } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(actorIds ? { actorId: { in: actorIds } } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [total, events] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const actorIdsToResolve = Array.from(new Set(events.map((event) => event.actorId).filter((id) => id !== SYSTEM_ACTOR_ID)));
    const tenantIdsToResolve = Array.from(new Set(events.map((event) => event.tenantId).filter((id): id is string => Boolean(id))));

    const [admins, tenantUsers, tenants] = await Promise.all([
      actorIdsToResolve.length
        ? prisma.adminUser.findMany({ where: { id: { in: actorIdsToResolve } }, select: { id: true, email: true, fullName: true } })
        : Promise.resolve([]),
      actorIdsToResolve.length
        ? prisma.tenantUser.findMany({ where: { id: { in: actorIdsToResolve } }, select: { id: true, email: true, fullName: true } })
        : Promise.resolve([]),
      tenantIdsToResolve.length
        ? prisma.tenant.findMany({ where: { id: { in: tenantIdsToResolve } }, select: { id: true, name: true, slug: true } })
        : Promise.resolve([]),
    ]);

    const actorMap = new Map<string, { email: string; fullName: string }>();
    admins.forEach((admin) => actorMap.set(admin.id, { email: admin.email, fullName: admin.fullName }));
    tenantUsers.forEach((user) => actorMap.set(user.id, { email: user.email, fullName: user.fullName }));
    const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant]));

    const enrichedEvents = events.map((event) => ({
      ...event,
      actor: event.actorId === SYSTEM_ACTOR_ID ? { email: "system", fullName: "System" } : actorMap.get(event.actorId) ?? null,
      tenant: event.tenantId ? tenantMap.get(event.tenantId) ?? null : null,
    }));

    return NextResponse.json({ events: enrichedEvents, total, page, limit });
  } catch (error) {
    console.error("Failed to fetch audit log:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
