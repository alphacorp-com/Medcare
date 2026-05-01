import { ModuleStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type IncomingModuleAssignment = {
  moduleId: string;
  status: ModuleStatus;
  expiresAt?: string | null;
  notes?: string | null;
};

export async function PUT(request: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenantId } = await context.params;
    const body = await request.json();
    const modules = (body.modules || []) as IncomingModuleAssignment[];

    if (!Array.isArray(modules)) {
      return NextResponse.json({ error: "modules must be an array" }, { status: 400 });
    }

    await prisma.$transaction(
      modules.map((entry) =>
        prisma.tenantModule.upsert({
          where: {
            tenantId_moduleId: {
              tenantId,
              moduleId: entry.moduleId,
            },
          },
          create: {
            tenantId,
            moduleId: entry.moduleId,
            status: entry.status,
            activatedAt: entry.status === "active" ? new Date() : null,
            expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
            activatedBy: session.user.id,
            notes: entry.notes || null,
          },
          update: {
            status: entry.status,
            activatedAt: entry.status === "active" ? new Date() : null,
            expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
            notes: entry.notes || null,
          },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update tenant modules:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
