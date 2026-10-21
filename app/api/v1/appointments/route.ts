import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addMonths, addWeeks } from "date-fns";
import { findAppointmentConflicts, findAvailabilityConflict } from "@/lib/scheduling/conflicts";
import { isBookableDoctor } from "@/lib/scheduling/doctors";
import { requireModulePermission } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import type { AppointmentStatus } from "@prisma/client";
import { randomUUID } from "crypto";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;

// ── GET /api/v1/appointments ────────────────────────────────────────────────
// Query params: doctorId, status, from, to (ISO dates, filters on scheduledAt)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_APPOINTMENTS", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const status = searchParams.get("status") as AppointmentStatus | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: session.user.tenantId,
      doctorId: doctorId ?? undefined,
      status: status ?? undefined,
      scheduledAt:
        from || to
          ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
          : undefined,
    },
    include: { patient: { select: PATIENT_SELECT } },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json({ data: appointments, total: appointments.length, success: true });
}

// ── POST /api/v1/appointments ───────────────────────────────────────────────
// Body: { patientId, doctorId, departmentId?, appointmentTypeCode?, scheduledAt,
//         durationMinutes?, reasonForVisit?, notes?, force?,
//         recurrence?: { frequency: 'weekly'|'monthly', occurrences: number } }
// With `recurrence`, creates one appointment per occurrence sharing a seriesId — each
// occurrence is conflict-checked independently; occurrences that conflict are skipped
// (reported back) rather than blocking the whole series, unless `force` is set.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_APPOINTMENTS", "create");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const body = await req.json();
    const {
      patientId,
      doctorId,
      departmentId,
      appointmentTypeCode,
      scheduledAt,
      durationMinutes,
      reasonForVisit,
      notes,
      force,
      recurrence,
    } = body;

    if (!patientId || !doctorId || !scheduledAt) {
      return NextResponse.json(
        { error: "patientId, doctorId and scheduledAt are required" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    if (!(await isBookableDoctor(session.user.tenantId, doctorId))) {
      return NextResponse.json({ error: "Doctor not found or not a clinical provider" }, { status: 400 });
    }

    const duration = durationMinutes ? Number(durationMinutes) : 30;
    const baseDate = new Date(scheduledAt);
    if (Number.isNaN(baseDate.getTime())) {
      return NextResponse.json({ error: "scheduledAt is not a valid date" }, { status: 400 });
    }
    const occurrenceDates: Date[] = [baseDate];

    if (recurrence?.frequency && recurrence?.occurrences > 1) {
      // Calendar steps: "monthly" keeps the same day of month (addMonths clamps the 31st
      // to the month's last day) instead of drifting by fixed 30-day blocks.
      const step = recurrence.frequency === "monthly" ? addMonths : addWeeks;
      for (let i = 1; i < Math.min(Number(recurrence.occurrences), 52); i++) {
        occurrenceDates.push(step(baseDate, i));
      }
    }

    const seriesId = occurrenceDates.length > 1 ? randomUUID() : null;
    const created: unknown[] = [];
    const skipped: Array<{ scheduledAt: string; conflicts: unknown[] }> = [];

    for (const date of occurrenceDates) {
      if (!force) {
        const [resourceConflicts, availabilityIssue] = await Promise.all([
          findAppointmentConflicts({ tenantId: session.user.tenantId, doctorId, scheduledAt: date, durationMinutes: duration }),
          findAvailabilityConflict(session.user.tenantId, doctorId, date),
        ]);
        if (resourceConflicts.length > 0 || availabilityIssue) {
          skipped.push({
            scheduledAt: date.toISOString(),
            conflicts: availabilityIssue ? [{ reason: availabilityIssue }] : resourceConflicts,
          });
          continue;
        }
      }

      const appointment = await prisma.appointment.create({
        data: {
          tenantId: session.user.tenantId,
          patientId,
          doctorId,
          departmentId: departmentId || null,
          appointmentTypeCode: appointmentTypeCode || null,
          scheduledAt: date,
          durationMinutes: duration,
          reasonForVisit: reasonForVisit || null,
          notes: notes || null,
          seriesId,
          createdBy: session.user.id,
        },
        include: { patient: { select: PATIENT_SELECT } },
      });
      created.push(appointment);

      const { ipAddress, userAgent } = extractRequestMeta(req.headers);
      await recordAuditEvent({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorType: session.user.role === "admin" ? "admin" : "tenant_user",
        action: "appointment.created",
        resourceType: "appointment",
        resourceId: appointment.id,
        ipAddress,
        userAgent,
      });
    }

    if (created.length === 0) {
      return NextResponse.json({ error: "Scheduling conflict", skipped }, { status: 409 });
    }

    return NextResponse.json({ data: created, skipped, success: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
