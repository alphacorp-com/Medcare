import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

// ── POST /api/v1/profile/change-password ────────────────────────────────────
// A tenant user (any role) changing their OWN password — requires the current password,
// unlike the tenant_admin/super_admin "reset a colleague's password" flows elsewhere, which
// don't need it. Mirrors app/api/admin/profile/change-password/route.ts for MedCare admins.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const tenantUser = await prisma.tenantUser.findUnique({ where: { id: session.user.id } });
    if (!tenantUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, tenantUser.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Bumping sessionVersion invalidates every session issued before this change —
    // including the one making this request — so the user (and anyone else holding a
    // copy of an old token) is signed out and must reauthenticate with the new password.
    await prisma.tenantUser.update({
      where: { id: session.user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "user.password_change",
      resourceType: "tenant_user",
      resourceId: session.user.id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to change password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
