import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isAdminOrTenantAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.id !== id && !isAdminOrTenantAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.tenantUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        modules: true,
        isActive: true,
        lastLoginAt: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      status: user.isActive ? 'active' : 'inactive',
      lastActive: user.lastLoginAt?.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.id !== id && !isAdminOrTenantAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { fullName, email, role, modules, status, password } = body;

    const existingUser = await prisma.tenantUser.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (password && password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const canManage = isAdminOrTenantAdmin(session);

    const updatedUser = await prisma.tenantUser.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(email && { email }),
        ...(role && canManage && { role }),
        ...(modules && canManage && { modules }),
        ...(status && canManage && { isActive: status === 'active' }),
        ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
      },
    });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    const roleChanged = role && canManage && role !== existingUser.role;
    const modulesChanged = modules && canManage &&
      JSON.stringify(modules) !== JSON.stringify(existingUser.modules);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: session.user.role === "admin" ? "admin" : "tenant_user",
      action: "user.update",
      resourceType: "tenant_user",
      resourceId: id,
      payload: {
        fields: Object.keys(body),
        ...(roleChanged ? { roleChanged: { from: existingUser.role, to: role } } : {}),
        ...(modulesChanged ? { modulesChanged: { from: existingUser.modules, to: modules } } : {}),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      modules: updatedUser.modules,
      status: updatedUser.isActive ? 'active' : 'inactive',
      lastActive: updatedUser.lastLoginAt?.toISOString(),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminOrTenantAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingUser = await prisma.tenantUser.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.tenantUser.delete({
      where: { id },
    });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: session.user.role === "admin" ? "admin" : "tenant_user",
      action: "user.delete",
      resourceType: "tenant_user",
      resourceId: id,
      payload: { deletedEmail: existingUser.email, deletedFullName: existingUser.fullName },
      ipAddress,
      userAgent,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
