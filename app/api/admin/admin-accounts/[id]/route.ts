import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AdminRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { assertNotLastActiveSuperAdmin } from "@/lib/admin-accounts";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

const ADMIN_ACCOUNT_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Admin account not found" }, { status: 404 });
    }

    const body = await request.json();
    const { fullName, role, isActive } = body;

    if (role !== undefined && !Object.values(AdminRole).includes(role)) {
      return NextResponse.json({ error: "Invalid admin role" }, { status: 400 });
    }

    const isSelf = id === session!.user.id;
    const demotingFromSuperAdmin = existing.role === "superadmin" && role !== undefined && role !== "superadmin";
    const deactivating = existing.role === "superadmin" && isActive === false;

    if (isSelf && (demotingFromSuperAdmin || deactivating)) {
      return NextResponse.json(
        { error: "You cannot demote or deactivate your own account here. Ask another super admin to do it." },
        { status: 400 }
      );
    }

    if (demotingFromSuperAdmin || deactivating) {
      const lockoutCheck = await assertNotLastActiveSuperAdmin(id);
      if (!lockoutCheck.ok) {
        return NextResponse.json({ error: lockoutCheck.error }, { status: lockoutCheck.status });
      }
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: ADMIN_ACCOUNT_SELECT,
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      actorId: session!.user.id,
      actorType: "admin",
      action: "admin_account.update",
      resourceType: "admin_user",
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

    return NextResponse.json({ adminUser: updated });
  } catch (error) {
    console.error("Failed to update admin account:", error);
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

    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Admin account not found" }, { status: 404 });
    }

    // Super admin accounts can never be deleted — by anyone, including another super admin —
    // to rule out ever locking the platform out of super-admin access by mistake. Demote the
    // account to another role first (still guarded against removing the last active one) or
    // deactivate it if it needs to be shut off.
    if (existing.role === "superadmin") {
      return NextResponse.json(
        { error: "Super admin accounts cannot be deleted. Demote the account to another role or deactivate it instead." },
        { status: 400 }
      );
    }

    if (id === session!.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account here. Ask another super admin to do it." },
        { status: 400 }
      );
    }

    await prisma.adminUser.delete({ where: { id } });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      actorId: session!.user.id,
      actorType: "admin",
      action: "admin_account.delete",
      resourceType: "admin_user",
      resourceId: id,
      payload: { deletedEmail: existing.email, deletedFullName: existing.fullName, deletedRole: existing.role },
      ipAddress,
      userAgent,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete admin account:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
