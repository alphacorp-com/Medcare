import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrServiceAuth } from "@/lib/admin/service-auth";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminOrServiceAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, slug, type, status, contactEmail } = body;

    if (!name || !slug || !type || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existingSlug = await prisma.tenant.findFirst({
      where: {
        slug,
        id: { not: id },
      },
      select: { id: true },
    });

    if (existingSlug) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name,
        slug,
        type,
        status,
        contactEmail: contactEmail || null,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        status: true,
        contactEmail: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Failed to update tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
