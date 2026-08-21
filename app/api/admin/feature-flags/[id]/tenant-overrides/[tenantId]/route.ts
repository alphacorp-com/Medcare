import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; tenantId: string }> }) {
  try {
    const { id, tenantId } = await context.params;
    const session = await getServerSession(authOptions);
    const permCheck = requireSuperAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 });
    }

    const existing = await prisma.tenantFeatureFlag.findUnique({
      where: { tenantId_flagId: { tenantId, flagId: id } },
      include: { tenant: { select: { name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }

    await prisma.tenantFeatureFlag.delete({ where: { tenantId_flagId: { tenantId, flagId: id } } });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId,
      actorId: session!.user.id,
      actorType: "admin",
      action: "feature_flag.tenant_override_remove",
      resourceType: "tenant_feature_flag",
      resourceId: existing.id,
      payload: { flagKey: flag.key, tenant: existing.tenant.name },
      ipAddress,
      userAgent,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove tenant feature flag override:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
