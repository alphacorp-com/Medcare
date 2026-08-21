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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const flags = await prisma.featureFlag.findMany({
      select: FEATURE_FLAG_SELECT,
      orderBy: { key: "asc" },
    });

    return NextResponse.json({ flags });
  } catch (error) {
    console.error("Failed to fetch feature flags:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const body = await request.json();
    const { key, description, moduleId, defaultValue, isGlobal, rolloutPct } = body;

    if (!key || typeof key !== "string" || !key.trim()) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const rollout = rolloutPct === undefined || rolloutPct === null || rolloutPct === "" ? 0 : Number(rolloutPct);
    if (Number.isNaN(rollout) || rollout < 0 || rollout > 100) {
      return NextResponse.json({ error: "Rollout percentage must be between 0 and 100" }, { status: 400 });
    }

    const existing = await prisma.featureFlag.findUnique({ where: { key: key.trim() } });
    if (existing) {
      return NextResponse.json({ error: "A feature flag with this key already exists" }, { status: 409 });
    }

    const flag = await prisma.featureFlag.create({
      data: {
        key: key.trim(),
        description: description || null,
        moduleId: moduleId || null,
        defaultValue: Boolean(defaultValue),
        isGlobal: Boolean(isGlobal),
        rolloutPct: rollout,
      },
      select: FEATURE_FLAG_SELECT,
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      actorId: session!.user.id,
      actorType: "admin",
      action: "feature_flag.create",
      resourceType: "feature_flag",
      resourceId: flag.id,
      payload: { key: flag.key, defaultValue: flag.defaultValue, isGlobal: flag.isGlobal, rolloutPct: flag.rolloutPct },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    console.error("Failed to create feature flag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
