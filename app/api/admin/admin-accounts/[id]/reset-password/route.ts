import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { generateTemporaryPassword } from "@/lib/tenant-licensing";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Invalidates every session this admin currently holds — the whole point of a
    // forced reset (e.g. a lost/stolen device) is that it takes effect immediately,
    // not only once their existing token happens to expire.
    await prisma.adminUser.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      actorId: session!.user.id,
      actorType: "admin",
      action: "admin_account.password_reset",
      resourceType: "admin_user",
      resourceId: id,
      payload: { email: existing.email },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ temporaryPassword });
  } catch (error) {
    console.error("Failed to reset admin account password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
