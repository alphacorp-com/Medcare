import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { DepartmentType } from "@prisma/client";

// PATCH /api/v1/departments/[id]
// Body: { name?, code?, type?, headId?, phone?, location?, isActive? }
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized - Tenant admin access required" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.department.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, code, type, headId, phone, location, isActive } = body as {
      name?: string;
      code?: string;
      type?: DepartmentType | null;
      headId?: string | null;
      phone?: string | null;
      location?: string | null;
      isActive?: boolean;
    };

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: name?.trim() || undefined,
        code: code?.trim() ? code.trim().toUpperCase() : undefined,
        type: type !== undefined ? type || null : undefined,
        headId: headId !== undefined ? headId || null : undefined,
        phone: phone !== undefined ? phone || null : undefined,
        location: location !== undefined ? location || null : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json(department);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A department with this code already exists" }, { status: 409 });
    }
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }
    console.error("[PATCH /api/v1/departments/:id]", error);
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
  }
}
