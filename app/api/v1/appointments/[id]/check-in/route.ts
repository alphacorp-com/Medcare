import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { withNextStayNumber } from "@/lib/stays/numbering";
import { requireModulePermission } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { chargeAdmissionAct, isPaymentGateActive } from "@/lib/billing/paymentGate";

// POST /api/v1/appointments/[id]/check-in
// The bridge into the existing clinical pipeline: creates a real Stay (type
// "scheduled", already in the consultation queue via consultationStatus "waiting") and
// links it back to the appointment. Everything downstream — triage, the consultation
// queue, billing — already understands Stay and needs no appointment-specific code.
// Body (optional): { medicalActCode } — billed right away, and the stay waits for payment
// before reaching the consultation queue, same as a front-desk admission.
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
    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    if (appointment.stayId || appointment.status === "checked_in" || appointment.status === "completed") {
      return NextResponse.json({ error: "Appointment already checked in" }, { status: 400 });
    }
    if (appointment.status === "cancelled" || appointment.status === "no_show") {
      return NextResponse.json(
        { error: `Cannot check in an appointment with status "${appointment.status}"` },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { medicalActCode?: string };
    const act = body.medicalActCode
      ? await prisma.medicalAct.findFirst({
          where: { tenantId: session.user.tenantId, code: body.medicalActCode, isActive: true },
        })
      : null;
    if (body.medicalActCode && !act) {
      return NextResponse.json({ error: `Medical act "${body.medicalActCode}" was not found or is inactive` }, { status: 404 });
    }
    const awaitingPayment = Boolean(act) && (await isPaymentGateActive(session.user.tenantId));

    const { stay, updated } = await withNextStayNumber(session.user.tenantId, (stayNumber) => prisma.$transaction(async (tx) => {
      // Claim the appointment first, conditionally: the status check above ran outside
      // the transaction, so two simultaneous check-ins could both pass it. Only one of
      // them can flip a still-unlinked booked/confirmed appointment; the other aborts
      // before creating a second stay.
      const claimed = await tx.appointment.updateMany({
        where: { id, tenantId: session.user.tenantId, stayId: null, status: { in: ["booked", "confirmed"] } },
        data: { status: "checked_in" },
      });
      if (claimed.count !== 1) {
        throw new Error("ALREADY_CHECKED_IN");
      }

      const stay = await tx.stay.create({
        data: {
          tenantId: session.user.tenantId,
          patientId: appointment.patientId,
          stayNumber,
          type: "scheduled",
          status: "in_progress",
          consultationStatus: awaitingPayment ? "awaiting_payment" : "waiting",
          medicalActCode: act?.code ?? null,
          departmentId: appointment.departmentId,
          attendingDoctorId: appointment.doctorId,
          admissionReason: appointment.reasonForVisit,
        },
      });

      const updated = await tx.appointment.update({
        where: { id },
        data: { stayId: stay.id },
      });

      return { stay, updated };
    }));

    const billing = act
      ? await chargeAdmissionAct({
          tenantId: session.user.tenantId,
          patientId: appointment.patientId,
          stayId: stay.id,
          act,
          performedById: session.user.id,
        })
      : null;

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: session.user.role === "admin" ? "admin" : "tenant_user",
      action: "appointment.checked_in",
      resourceType: "appointment",
      resourceId: id,
      payload: { stayId: stay.id },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: updated, stay, billing, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CHECKED_IN") {
      return NextResponse.json({ error: "Appointment already checked in" }, { status: 409 });
    }
    console.error("Error checking in appointment:", error);
    return NextResponse.json({ error: "Failed to check in" }, { status: 500 });
  }
}
