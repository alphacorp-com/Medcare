import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { TenantUserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { generateTemporaryPassword, getTenantSeatLimit } from "@/lib/tenant-licensing";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const body = await request.json();
    const { tenantId, email, fullName, role } = body;

    if (!tenantId || !email || !fullName || !role) {
      return NextResponse.json({ error: "tenantId, email, fullName and role are required" }, { status: 400 });
    }

    if (!Object.values(TenantUserRole).includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const existingUser = await prisma.tenantUser.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const seatLimit = await getTenantSeatLimit(tenantId);
    if (seatLimit != null) {
      const activeUserCount = await prisma.tenantUser.count({ where: { tenantId, isActive: true } });
      if (activeUserCount >= seatLimit) {
        return NextResponse.json(
          { error: `User seat limit reached (${seatLimit}) for this tenant. Increase the tenant's plan seats first.` },
          { status: 403 }
        );
      }
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const newUser = await prisma.tenantUser.create({
      data: { tenantId, email, fullName, role, passwordHash, isActive: true, modules: [] },
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
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId,
      actorId: session!.user.id,
      actorType: "admin",
      action: "user.create",
      resourceType: "tenant_user",
      resourceId: newUser.id,
      payload: { email: newUser.email, role: newUser.role, tenant: tenant.name },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        user: { ...newUser, status: newUser.isActive ? "active" : "inactive", tenant },
        temporaryPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create tenant user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
