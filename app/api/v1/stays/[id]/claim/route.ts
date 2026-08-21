import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

// ── POST /api/v1/stays/:id/claim ────────────────────────────────────────────
// A doctor "receives" a waiting patient from the consultation queue. The conditional
// updateMany only succeeds if the stay is still "waiting" — closing the race where two
// doctors claim the same patient at once (mirrors the bed-conflict guard in
// app/api/v1/stays/[id]/route.ts).
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
      select: { id: true, patientId: true },
    });
    if (!existingStay) {
      return NextResponse.json({ error: "Stay not found", success: false }, { status: 404 });
    }

    const claimed = await prisma.stay.updateMany({
      where: { id, tenantId: session.user.tenantId, consultationStatus: "waiting" },
      data: { consultationStatus: "claimed", attendingDoctorId: session.user.id },
    });

    if (claimed.count !== 1) {
      return NextResponse.json(
        { error: "This patient has already been claimed by another doctor", success: false },
        { status: 409 }
      );
    }

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "stay.consultation_claim",
      resourceType: "stay",
      resourceId: id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/v1/stays/:id/claim]", error);
    return NextResponse.json({ error: "Failed to claim patient", success: false }, { status: 500 });
  }
}
