import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 });
    }

    const overrides = await prisma.tenantFeatureFlag.findMany({
      where: { flagId: id },
      select: {
        id: true,
        tenantId: true,
        value: true,
        reason: true,
        expiresAt: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ overrides });
  } catch (error) {
    console.error("Failed to fetch tenant feature flag overrides:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 });
    }

    const body = await request.json();
    const { tenantId, value, reason, expiresAt } = body;

    if (!tenantId || typeof value !== "boolean") {
      return NextResponse.json({ error: "tenantId and a boolean value are required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const override = await prisma.tenantFeatureFlag.upsert({
      where: { tenantId_flagId: { tenantId, flagId: id } },
      update: { value, reason: reason || null, expiresAt: expiresAt ? new Date(expiresAt) : null, setBy: session!.user.id },
      create: {
        tenantId,
        flagId: id,
        value,
        reason: reason || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        setBy: session!.user.id,
      },
      select: {
        id: true,
        tenantId: true,
        value: true,
        reason: true,
        expiresAt: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId,
      actorId: session!.user.id,
      actorType: "admin",
      action: "feature_flag.tenant_override_set",
      resourceType: "tenant_feature_flag",
      resourceId: override.id,
      payload: { flagKey: flag.key, tenant: tenant.name, value },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ override });
  } catch (error) {
    console.error("Failed to set tenant feature flag override:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
