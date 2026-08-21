import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { AdminRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { generateTemporaryPassword } from "@/lib/tenant-licensing";
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const adminUsers = await prisma.adminUser.findMany({
      select: ADMIN_ACCOUNT_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ adminUsers });
  } catch (error) {
    console.error("Failed to fetch admin accounts:", error);
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
    const { email, fullName, role } = body;

    if (!email || !fullName || !role) {
      return NextResponse.json({ error: "Email, full name, and role are required" }, { status: 400 });
    }

    if (!Object.values(AdminRole).includes(role)) {
      return NextResponse.json({ error: "Invalid admin role" }, { status: 400 });
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An admin account with this email already exists" }, { status: 409 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const adminUser = await prisma.adminUser.create({
      data: { email, fullName, role, passwordHash },
      select: ADMIN_ACCOUNT_SELECT,
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      actorId: session!.user.id,
      actorType: "admin",
      action: "admin_account.create",
      resourceType: "admin_user",
      resourceId: adminUser.id,
      payload: { email: adminUser.email, role: adminUser.role },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ adminUser, temporaryPassword }, { status: 201 });
  } catch (error) {
    console.error("Failed to create admin account:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
