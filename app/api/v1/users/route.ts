import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { isAdminOrTenantAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { getTenantSeatLimit } from "@/lib/tenant-licensing";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminOrTenantAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.tenantUser.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        modules: true,
        isActive: true,
        lastLoginAt: true,
        departmentId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const mappedUsers = users.map(user => ({
      ...user,
      status: user.isActive ? 'active' : 'inactive',
      lastActive: user.lastLoginAt?.toISOString(),
    }));

    return NextResponse.json(mappedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminOrTenantAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, fullName, role, modules, status } = body;

    if (!email || !fullName || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existingUser = await prisma.tenantUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    if (session.user.tenantId) {
      const seatLimit = await getTenantSeatLimit(session.user.tenantId);
      if (seatLimit != null) {
        const activeUserCount = await prisma.tenantUser.count({
          where: { tenantId: session.user.tenantId, isActive: true },
        });
        if (activeUserCount >= seatLimit) {
          return NextResponse.json(
            { error: `User seat limit reached (${seatLimit}). Contact your administrator to purchase additional seats.` },
            { status: 403 }
          );
        }
      }
    }

    // Hash a default password for newly created users from the dashboard
    const defaultPassword = "password123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const newUser = await prisma.tenantUser.create({
      data: {
        email,
        fullName,
        role,
        modules: modules || [],
        passwordHash,
        isActive: status === 'active',
        tenantId: session.user.tenantId,
      },
    });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: session.user.role === "admin" ? "admin" : "tenant_user",
      action: "user.create",
      resourceType: "tenant_user",
      resourceId: newUser.id,
      payload: { email: newUser.email, role: newUser.role, modules: newUser.modules },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      modules: newUser.modules,
      status: newUser.isActive ? 'active' : 'inactive',
      lastActive: newUser.lastLoginAt?.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
