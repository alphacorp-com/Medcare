import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

const TERMINAL_STATUSES = ["completed", "cancelled", "no_show"];

// POST /api/v1/appointments/[id]/cancel — Body: { reason? }
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_APPOINTMENTS", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const appointment = await prisma.appointment.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    if (TERMINAL_STATUSES.includes(appointment.status)) {
      return NextResponse.json(
        { error: `Cannot cancel an appointment with status "${appointment.status}"` },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelledReason: reason || null },
    });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: session.user.role === "admin" ? "admin" : "tenant_user",
      action: "appointment.cancelled",
      resourceType: "appointment",
      resourceId: id,
      payload: { reason: reason ?? null },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    return NextResponse.json({ error: "Failed to cancel appointment" }, { status: 500 });
  }
}
