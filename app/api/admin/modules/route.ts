import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [tenants, modules, tenantModules] = await Promise.all([
      prisma.tenant.findMany({
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { name: "asc" },
      }),
      prisma.module.findMany({
        select: { id: true, code: true, name: true, category: true, tier: true, isPublished: true },
        orderBy: { name: "asc" },
      }),
      prisma.tenantModule.findMany({
        select: {
          id: true,
          tenantId: true,
          moduleId: true,
          status: true,
          activatedAt: true,
          expiresAt: true,
          notes: true,
        },
      }),
    ]);

    return NextResponse.json({ tenants, modules, tenantModules });
  } catch (error) {
    console.error("Failed to fetch modules management data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
