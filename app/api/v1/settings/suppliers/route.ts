import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// Readable by any authenticated tenant member (e.g. Pharmacy staff picking a
// supplier on a medication form) — writes stay restricted to tenant admins.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(suppliers);
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
    const { code, name, contactName, phone, email, address } = body as {
      code?: string; name?: string; contactName?: string; phone?: string; email?: string; address?: string;
    };
    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: session.user.tenantId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/settings/suppliers]", error);
    return NextResponse.json({ error: "Failed to create supplier (code may already exist)" }, { status: 400 });
  }
}
