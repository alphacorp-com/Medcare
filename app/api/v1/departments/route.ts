import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { DepartmentType } from "@prisma/client";

// ── GET /api/v1/departments ─────────────────────────────────────────────────
// Returns departments for use in dropdowns/management. By default only active
// ones (existing dropdown consumers rely on this); pass includeInactive=true
// to also see deactivated departments (used by the Planning module's management view).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const departments = await prisma.department.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        headId: true,
        location: true,
        phone: true,
        isActive: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      data: departments,
      total: departments.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/departments]", error);
    return NextResponse.json(
      { error: "Failed to fetch departments", success: false },
      { status: 500 }
    );
  }
}

// ── POST /api/v1/departments ────────────────────────────────────────────────
// Body: { name, code, type?, headId?, phone?, location? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized - Tenant admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, code, type, headId, phone, location } = body as {
      name?: string;
      code?: string;
      type?: DepartmentType;
      headId?: string;
      phone?: string;
      location?: string;
    };

    if (!name?.trim() || !code?.trim()) {
      return NextResponse.json({ error: "name and code are required" }, { status: 400 });
    }

    const department = await prisma.department.create({
      data: {
        tenantId: session.user.tenantId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type: type || null,
        headId: headId || null,
        phone: phone || null,
        location: location || null,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A department with this code already exists" }, { status: 409 });
    }
    console.error("[POST /api/v1/departments]", error);
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}
