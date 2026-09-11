import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireAdminOrTenantAdmin, requireTenantAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

// Roles are tenant-scoped and admin-defined — no fixed catalog. isSystemAdmin
// grants full access and is the sole thing lib/permissions.ts checks for
// "is this an administrator"; the role's name is just a label.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireAdminOrTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const roles = await prisma.role.findMany({
      where: { tenantId: session.user.tenantId },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        isSystemAdmin: r.isSystemAdmin,
        isClinicalProvider: r.isClinicalProvider,
        defaultModules: r.defaultModules,
        userCount: r._count.users,
      }))
    );
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Defining a role (including whether it grants admin access) is a
    // tenant-wide authority decision — restricted to existing administrators,
    // same bar as managing departments or beds.
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const isSystemAdmin = Boolean(body.isSystemAdmin);
    const isClinicalProvider = Boolean(body.isClinicalProvider);
    const defaultModules = Array.isArray(body.defaultModules) ? body.defaultModules : [];

    if (!name) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }
    if (name.toLowerCase() === "revoked") {
      return NextResponse.json({ error: "This role name is reserved" }, { status: 400 });
    }

    const existing = await prisma.role.findFirst({
      where: { tenantId: session.user.tenantId, name },
    });
    if (existing) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
    }

    const role = await prisma.role.create({
      data: {
        tenantId: session.user.tenantId,
        name,
        isSystemAdmin,
        isClinicalProvider,
        defaultModules,
      },
    });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "role.create",
      resourceType: "role",
      resourceId: role.id,
      payload: { name: role.name, isSystemAdmin: role.isSystemAdmin, isClinicalProvider: role.isClinicalProvider },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        id: role.id,
        name: role.name,
        isSystemAdmin: role.isSystemAdmin,
        isClinicalProvider: role.isClinicalProvider,
        defaultModules: role.defaultModules,
        userCount: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
