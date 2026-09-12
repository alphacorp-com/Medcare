import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isAdminOrTenantAdmin, requireSelfOrAdmin, requireAdminOrTenantAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireSelfOrAdmin(session, id);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    // A tenant_admin (or a self-view) is restricted to their own tenant — a tenant_admin
    // from tenant A must not be able to fetch tenant B's user by id.
    const user = await prisma.tenantUser.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleId: true,
        role: { select: { name: true, isSystemAdmin: true } },
        modules: true,
        isActive: true,
        lastLoginAt: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { role, ...rest } = user;
    return NextResponse.json({
      ...rest,
      role: role.name,
      isSystemAdmin: role.isSystemAdmin,
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

    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permCheck = requireSelfOrAdmin(session, id);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const body = await req.json();
    const { fullName, email, roleId, modules, status, password } = body;

    const existingUser = await prisma.tenantUser.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: { role: { select: { id: true, name: true, isSystemAdmin: true } } },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (password && password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const canManage = isAdminOrTenantAdmin(session);

    let newRole: { id: string; name: string; isSystemAdmin: boolean } | null = null;
    if (roleId && canManage && roleId !== existingUser.roleId) {
      newRole = await prisma.role.findFirst({
        where: { id: roleId, tenantId: session.user.tenantId },
      });
      if (!newRole) {
        return NextResponse.json({ error: "Role not found" }, { status: 400 });
      }
      // Refuse a reassignment that would leave the tenant with zero active
      // administrators — the same self-lockout guard the roles API applies
      // when a role itself is demoted or deleted.
      if (existingUser.role.isSystemAdmin && !newRole.isSystemAdmin) {
        const otherActiveAdmins = await prisma.tenantUser.count({
          where: {
            tenantId: session.user.tenantId,
            isActive: true,
            id: { not: id },
            role: { isSystemAdmin: true },
          },
        });
        if (otherActiveAdmins === 0) {
          return NextResponse.json(
            { error: "This is the last administrator — assign another user an administrator role first." },
            { status: 400 }
          );
        }
      }
    }

    const updatedUser = await prisma.tenantUser.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(email && { email }),
        ...(newRole && { roleId: newRole.id }),
        ...(modules && canManage && { modules }),
        ...(status && canManage && { isActive: status === 'active' }),
        // Bumping sessionVersion when a password is set here invalidates this user's
        // existing sessions immediately, same as the dedicated reset-password routes.
        ...(password && { passwordHash: await bcrypt.hash(password, 10), sessionVersion: { increment: 1 } }),
      },
      include: { role: { select: { name: true, isSystemAdmin: true } } },
    });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    const modulesChanged = modules && canManage &&
      JSON.stringify(modules) !== JSON.stringify(existingUser.modules);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "user.update",
      resourceType: "tenant_user",
      resourceId: id,
      payload: {
        fields: Object.keys(body),
        ...(newRole ? { roleChanged: { from: existingUser.role.name, to: newRole.name } } : {}),
        ...(modulesChanged ? { modulesChanged: { from: existingUser.modules, to: modules } } : {}),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role.name,
      isSystemAdmin: updatedUser.role.isSystemAdmin,
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
    const permCheck = requireAdminOrTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const existingUser = await prisma.tenantUser.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
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
      actorType: "tenant_user",
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
