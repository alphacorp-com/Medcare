import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

const FEATURE_FLAG_SELECT = {
  id: true,
  key: true,
  description: true,
  moduleId: true,
  defaultValue: true,
  isGlobal: true,
  rolloutPct: true,
  createdAt: true,
  module: { select: { id: true, code: true, name: true } },
  _count: { select: { tenantFeatureFlags: true } },
} as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const existing = await prisma.featureFlag.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 });
    }

    const body = await request.json();
    const { description, moduleId, defaultValue, isGlobal, rolloutPct } = body;

    let rollout: number | undefined;
    if (rolloutPct !== undefined) {
      rollout = Number(rolloutPct);
      if (Number.isNaN(rollout) || rollout < 0 || rollout > 100) {
        return NextResponse.json({ error: "Rollout percentage must be between 0 and 100" }, { status: 400 });
      }
    }

    const flag = await prisma.featureFlag.update({
      where: { id },
      data: {
        ...(description !== undefined && { description: description || null }),
        ...(moduleId !== undefined && { moduleId: moduleId || null }),
        ...(defaultValue !== undefined && { defaultValue: Boolean(defaultValue) }),
        ...(isGlobal !== undefined && { isGlobal: Boolean(isGlobal) }),
        ...(rollout !== undefined && { rolloutPct: rollout }),
      },
      select: FEATURE_FLAG_SELECT,
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      actorId: session!.user.id,
      actorType: "admin",
      action: "feature_flag.update",
      resourceType: "feature_flag",
      resourceId: id,
      payload: { fields: Object.keys(body), key: existing.key },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ flag });
  } catch (error) {
    console.error("Failed to update feature flag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const existing = await prisma.featureFlag.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 });
    }

    await prisma.featureFlag.delete({ where: { id } });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      actorId: session!.user.id,
      actorType: "admin",
      action: "feature_flag.delete",
      resourceType: "feature_flag",
      resourceId: id,
      payload: { key: existing.key },
      ipAddress,
      userAgent,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete feature flag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
