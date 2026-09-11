import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const existing = await prisma.role.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const isSystemAdmin = typeof body.isSystemAdmin === "boolean" ? body.isSystemAdmin : undefined;
    const isClinicalProvider = typeof body.isClinicalProvider === "boolean" ? body.isClinicalProvider : undefined;
    const defaultModules = Array.isArray(body.defaultModules) ? body.defaultModules : undefined;

    if (name !== undefined) {
      if (!name) {
        return NextResponse.json({ error: "Role name is required" }, { status: 400 });
      }
      if (name.toLowerCase() === "revoked") {
        return NextResponse.json({ error: "This role name is reserved" }, { status: 400 });
      }
      const nameTaken = await prisma.role.findFirst({
        where: { tenantId: session.user.tenantId, name, id: { not: id } },
      });
      if (nameTaken) {
        return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
      }
    }

    // Demoting the tenant's last administrator role would lock the whole
    // install out of its own admin settings — refuse it, same guard applied
    // when reassigning a single user's role in PUT /api/v1/users/[id].
    if (existing.isSystemAdmin && isSystemAdmin === false) {
      const otherActiveAdmins = await prisma.tenantUser.count({
        where: {
          tenantId: session.user.tenantId,
          isActive: true,
          roleId: { not: id },
          role: { isSystemAdmin: true },
        },
      });
      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { error: "This is the last administrator role — create or promote another admin first." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(isSystemAdmin !== undefined && { isSystemAdmin }),
        ...(isClinicalProvider !== undefined && { isClinicalProvider }),
        ...(defaultModules !== undefined && { defaultModules }),
      },
    });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "role.update",
      resourceType: "role",
      resourceId: id,
      payload: {
        fields: Object.keys(body),
        ...(name !== undefined && name !== existing.name ? { nameChanged: { from: existing.name, to: name } } : {}),
        ...(isSystemAdmin !== undefined && isSystemAdmin !== existing.isSystemAdmin
          ? { isSystemAdminChanged: { from: existing.isSystemAdmin, to: isSystemAdmin } }
          : {}),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      isSystemAdmin: updated.isSystemAdmin,
      isClinicalProvider: updated.isClinicalProvider,
      defaultModules: updated.defaultModules,
    });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const existing = await prisma.role.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (existing._count.users > 0) {
      return NextResponse.json(
        { error: "This role is assigned to one or more users — reassign them before deleting it" },
        { status: 409 }
      );
    }

    await prisma.role.delete({ where: { id } });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "role.delete",
      resourceType: "role",
      resourceId: id,
      payload: { name: existing.name },
      ipAddress,
      userAgent,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
