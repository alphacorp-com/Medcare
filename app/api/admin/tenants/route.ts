import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateTemporaryPassword } from "@/lib/tenant-licensing";

export async function GET(request: NextRequest) {
  try {
    // Check admin session
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        status: true,
        contactEmail: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error("Failed to fetch tenants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin session
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, type, contactEmail, adminUser } = body;

    // Validate required fields
    if (!name || !slug || !type) {
      return NextResponse.json(
        { error: "Name, slug, and type are required" },
        { status: 400 }
      );
    }

    // Check if slug is unique
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 400 }
      );
    }

    const wantsAdminUser = adminUser && typeof adminUser === "object" && adminUser.email && adminUser.fullName;

    if (wantsAdminUser) {
      const existingUser = await prisma.tenantUser.findUnique({ where: { email: adminUser.email } });
      if (existingUser) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
      }
    }

    let temporaryPassword: string | null = null;

    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name,
          slug,
          type,
          contactEmail,
          dbSchema: `tenant_${slug}`,
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

      if (wantsAdminUser) {
        temporaryPassword = generateTemporaryPassword();
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        await tx.tenantUser.create({
          data: {
            tenantId: createdTenant.id,
            email: adminUser.email,
            fullName: adminUser.fullName,
            role: "tenant_admin",
            passwordHash,
            isActive: true,
          },
        });
      }

      return createdTenant;
    });

    return NextResponse.json(
      { tenant, ...(temporaryPassword ? { adminTemporaryPassword: temporaryPassword } : {}) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}