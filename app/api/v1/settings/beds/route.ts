import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { BedStatus } from "@prisma/client";

// Readable by any authenticated tenant member (used by admission/transfer bed
// pickers, not just the settings management page) — writes stay admin-only.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get("departmentId") || undefined;
  const status = (searchParams.get("status") as BedStatus | null) || undefined;
  const includeInactive = searchParams.get("includeInactive") === "true";

  const beds = await prisma.bed.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(departmentId ? { departmentId } : {}),
      ...(status ? { status } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(beds);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const body = await request.json();
    const { code, label, departmentId, roomTypeId } = body as {
      code?: string; label?: string; departmentId?: string; roomTypeId?: string;
    };
    if (!code?.trim() || !label?.trim() || !departmentId) {
      return NextResponse.json({ error: "code, label and departmentId are required" }, { status: 400 });
    }

    const department = await prisma.department.findFirst({
      where: { id: departmentId, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const bed = await prisma.bed.create({
      data: {
        tenantId: session.user.tenantId,
        code: code.trim().toUpperCase(),
        label: label.trim(),
        departmentId,
        roomTypeId: roomTypeId || null,
      },
    });
    return NextResponse.json(bed, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A bed with this code already exists" }, { status: 409 });
    }
    console.error("[POST /api/v1/settings/beds]", error);
    return NextResponse.json({ error: "Failed to create bed" }, { status: 500 });
  }
}
