import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { TenantUserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const existing = await prisma.tenantUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { fullName, role, isActive } = body;

    if (role !== undefined && !Object.values(TenantUserRole).includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const updated = await prisma.tenantUser.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
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
      tenantId: existing.tenantId,
      actorId: session!.user.id,
      actorType: "admin",
      action: "user.update",
      resourceType: "tenant_user",
      resourceId: id,
      payload: {
        fields: Object.keys(body),
        ...(role !== undefined && role !== existing.role ? { roleChanged: { from: existing.role, to: role } } : {}),
        ...(isActive !== undefined && isActive !== existing.isActive
          ? { statusChanged: { from: existing.isActive, to: isActive } }
          : {}),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ user: { ...updated, status: updated.isActive ? "active" : "inactive" } });
  } catch (error) {
    console.error("Failed to update tenant user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const existing = await prisma.tenantUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.tenantUser.delete({ where: { id } });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId: existing.tenantId,
      actorId: session!.user.id,
      actorType: "admin",
      action: "user.delete",
      resourceType: "tenant_user",
      resourceId: id,
      payload: { deletedEmail: existing.email, deletedFullName: existing.fullName },
      ipAddress,
      userAgent,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete tenant user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
