import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// Readable by any authenticated tenant member (e.g. Pharmacy staff picking a
// storage location on a medication form) — writes stay restricted to tenant admins.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locations = await prisma.storageLocation.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(locations);
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
    const { code, name, address } = body as { code?: string; name?: string; address?: string };
    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }

    const location = await prisma.storageLocation.create({
      data: {
        tenantId: session.user.tenantId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address?.trim() || null,
      },
    });
    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/settings/storage-locations]", error);
    return NextResponse.json({ error: "Failed to create location (code may already exist)" }, { status: 400 });
  }
}
