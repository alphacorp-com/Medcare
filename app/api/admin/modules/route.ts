import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrServiceAuth } from "@/lib/admin/service-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrServiceAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
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
