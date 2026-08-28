import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        logoUrl: true,
        metadata: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error fetching organization settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Editing the organization's public identity (name, contact, logo) is an admin
  // action — every sibling settings route gates writes behind this same check, this
  // one had been missed and let any authenticated tenant user edit it.
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const data = await req.json();
    const { name, contactEmail, contactPhone, address, logoUrl, taxId, website } = data;

    // Get current metadata to preserve other fields
    const currentTenant = await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { metadata: true }
    });

    const updatedTenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        name,
        contactEmail,
        contactPhone,
        address,
        logoUrl,
        metadata: {
          ...(typeof currentTenant?.metadata === 'object' ? (currentTenant.metadata as object) : {}),
          taxId,
          website,
        },
      },
    });

    return NextResponse.json(updatedTenant);
  } catch (error) {
    console.error("Error updating organization settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
