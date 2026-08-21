import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const tenantId = request.nextUrl.searchParams.get("tenantId");

    const users = await prisma.tenantUser.findMany({
      where: tenantId ? { tenantId } : {},
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tenantId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const tenantIds = Array.from(new Set(users.map((user) => user.tenantId).filter((id): id is string => Boolean(id))));
    const tenants = tenantIds.length
      ? await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

    const enrichedUsers = users.map((user) => ({
      ...user,
      status: user.isActive ? "active" : "inactive",
      tenant: user.tenantId ? tenantsById.get(user.tenantId) ?? null : null,
    }));

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Failed to fetch tenant users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
