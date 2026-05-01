import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
