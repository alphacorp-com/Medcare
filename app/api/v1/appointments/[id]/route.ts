import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findAppointmentConflicts, findAvailabilityConflict } from "@/lib/scheduling/conflicts";
import { requireModulePermission } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;
const EDITABLE_STATUSES = ["booked", "confirmed"];

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_APPOINTMENTS", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { patient: { select: PATIENT_SELECT } },
  });

  if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  return NextResponse.json(appointment);
}

// PATCH /api/v1/appointments/[id]
// Reschedule/edit — only allowed while still booked or confirmed.
// Body: { scheduledAt?, doctorId?, departmentId?, appointmentTypeCode?, durationMinutes?,
//         reasonForVisit?, notes?, force? }
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
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
    const existing = await prisma.appointment.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    if (!EDITABLE_STATUSES.includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot edit an appointment with status "${existing.status}"` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { scheduledAt, doctorId, departmentId, appointmentTypeCode, durationMinutes, reasonForVisit, notes, force } =
      body;

    const nextDoctorId = doctorId ?? existing.doctorId;
    const nextScheduledAt = scheduledAt ? new Date(scheduledAt) : existing.scheduledAt;
    const nextDuration = durationMinutes ? Number(durationMinutes) : existing.durationMinutes;

    if (!force) {
      const [resourceConflicts, availabilityIssue] = await Promise.all([
        findAppointmentConflicts({
          doctorId: nextDoctorId,
          scheduledAt: nextScheduledAt,
          durationMinutes: nextDuration,
          excludeId: id,
        }),
        findAvailabilityConflict(session.user.tenantId, nextDoctorId, nextScheduledAt),
      ]);
      if (resourceConflicts.length > 0 || availabilityIssue) {
        return NextResponse.json(
          { error: "Scheduling conflict", conflicts: availabilityIssue ? [{ reason: availabilityIssue }] : resourceConflicts },
          { status: 409 }
        );
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: nextScheduledAt,
        doctorId: doctorId ?? undefined,
        departmentId: departmentId !== undefined ? departmentId || null : undefined,
        appointmentTypeCode: appointmentTypeCode !== undefined ? appointmentTypeCode || null : undefined,
        durationMinutes: nextDuration,
        reasonForVisit: reasonForVisit !== undefined ? reasonForVisit || null : undefined,
        notes: notes !== undefined ? notes || null : undefined,
        status: existing.status === "booked" ? "confirmed" : undefined,
      },
      include: { patient: { select: PATIENT_SELECT } },
    });

    const { ipAddress, userAgent } = extractRequestMeta(req.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: session.user.role === "admin" ? "admin" : "tenant_user",
      action: "appointment.rescheduled",
      resourceType: "appointment",
      resourceId: appointment.id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Error updating appointment:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
