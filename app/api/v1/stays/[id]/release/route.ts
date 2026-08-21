import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission, isAdminOrTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

// ── POST /api/v1/stays/:id/release ──────────────────────────────────────────
// Puts a claimed-but-not-yet-completed stay back into the shared "waiting" pool —
// only the doctor currently holding it, or an admin/tenant_admin, may release it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_ADMISSION", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;

    const existingStay = await prisma.stay.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true, attendingDoctorId: true, consultationStatus: true },
    });
    if (!existingStay) {
      return NextResponse.json({ error: "Stay not found", success: false }, { status: 404 });
    }

    if (existingStay.consultationStatus !== "claimed") {
      return NextResponse.json({ error: "This patient is not currently claimed", success: false }, { status: 409 });
    }

    const canRelease = existingStay.attendingDoctorId === session.user.id || isAdminOrTenantAdmin(session);
    if (!canRelease) {
      return NextResponse.json(
        { error: "Only the claiming doctor or a tenant admin can release this patient", success: false },
        { status: 403 }
      );
    }

    await prisma.stay.update({
      where: { id },
      data: { consultationStatus: "waiting", attendingDoctorId: null },
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "stay.consultation_release",
      resourceType: "stay",
      resourceId: id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/v1/stays/:id/release]", error);
    return NextResponse.json({ error: "Failed to release patient", success: false }, { status: 500 });
  }
}
