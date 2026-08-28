import { LicenseKeyStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

// POST /api/admin/licenses/[id]/revoke
// The schema already had a `revokedAt` column with no route ever setting it — this
// was the missing incident-response lever: if a key leaks, there was previously no
// way to invalidate it before a tenant (or anyone who obtained it) redeems it.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const permCheck = requireSuperAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const license = await prisma.licenseKey.findUnique({ where: { id } });
    if (!license) {
      return NextResponse.json({ error: "License key not found." }, { status: 404 });
    }
    if (license.revokedAt) {
      return NextResponse.json({ error: "This license key is already revoked." }, { status: 400 });
    }
    if (license.status === LicenseKeyStatus.redeemed) {
      return NextResponse.json(
        { error: "This key has already been redeemed — revoking it won't undo the activation it already granted. Suspend the tenant instead if access needs to be cut." },
        { status: 400 }
      );
    }

    const updated = await prisma.licenseKey.update({
      where: { id },
      data: { status: LicenseKeyStatus.revoked, revokedAt: new Date() },
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId: license.tenantId,
      actorId: session!.user.id,
      actorType: "admin",
      action: "license.revoked",
      resourceType: "license_key",
      resourceId: id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to revoke license key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
