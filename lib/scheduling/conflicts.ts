import prisma from "@/lib/prisma";

// Shared by every "is this resource already busy around this time" check in the app
// (surgery scheduling, appointment booking) — there's no stored end time for either,
// so a conflict is approximated as another active record for the same resource within
// a fixed buffer window around the requested start time.
export const DEFAULT_CONFLICT_WINDOW_MINUTES = 90;

export interface SurgeryConflictCheck {
  surgeonId: string;
  roomId?: string | null;
  scheduledAt: Date;
  excludeId?: string;
}

export interface SurgeryConflict {
  resource: "surgeon" | "room";
  procedureId: string;
  procedureLabel: string;
  scheduledAt: string;
  patientName: string;
}

export async function findSurgeryConflicts({
  surgeonId,
  roomId,
  scheduledAt,
  excludeId,
}: SurgeryConflictCheck): Promise<SurgeryConflict[]> {
  const windowStart = new Date(scheduledAt.getTime() - DEFAULT_CONFLICT_WINDOW_MINUTES * 60_000);
  const windowEnd = new Date(scheduledAt.getTime() + DEFAULT_CONFLICT_WINDOW_MINUTES * 60_000);

  const candidates = await prisma.surgicalProcedure.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: ["scheduled", "in_progress"] },
      scheduledAt: { gte: windowStart, lte: windowEnd },
      OR: [{ surgeonId }, ...(roomId ? [{ roomId }] : [])],
    },
    include: { patient: { select: { firstName: true, lastName: true } } },
  });

  return candidates.map((c) => ({
    resource: c.surgeonId === surgeonId ? "surgeon" : "room",
    procedureId: c.id,
    procedureLabel: c.procedureLabel,
    scheduledAt: (c.scheduledAt ?? new Date()).toISOString(),
    patientName: `${c.patient.firstName} ${c.patient.lastName}`,
  }));
}

export interface AppointmentConflictCheck {
  doctorId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  excludeId?: string;
}

export interface AppointmentConflict {
  appointmentId: string;
  scheduledAt: string;
  patientName: string;
}

export async function findAppointmentConflicts({
  doctorId,
  scheduledAt,
  durationMinutes = 30,
  excludeId,
}: AppointmentConflictCheck): Promise<AppointmentConflict[]> {
  const windowMinutes = Math.max(durationMinutes, DEFAULT_CONFLICT_WINDOW_MINUTES);
  const windowStart = new Date(scheduledAt.getTime() - windowMinutes * 60_000);
  const windowEnd = new Date(scheduledAt.getTime() + windowMinutes * 60_000);

  const candidates = await prisma.appointment.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      doctorId,
      status: { in: ["booked", "confirmed", "checked_in"] },
      scheduledAt: { gte: windowStart, lte: windowEnd },
    },
    include: { patient: { select: { firstName: true, lastName: true } } },
  });

  return candidates.map((c) => ({
    appointmentId: c.id,
    scheduledAt: c.scheduledAt.toISOString(),
    patientName: `${c.patient.firstName} ${c.patient.lastName}`,
  }));
}

// Checks the requested time against the doctor's configured weekly availability
// (DoctorAvailability). Returns a human-readable reason when the slot falls outside
// any configured window for that weekday, or null when it's within bounds — or when
// the doctor has no availability configured at all (nothing to enforce yet).
export async function findAvailabilityConflict(
  tenantId: string | null | undefined,
  doctorId: string,
  scheduledAt: Date
): Promise<string | null> {
  const windows = await prisma.doctorAvailability.findMany({
    where: { tenantId: tenantId ?? undefined, doctorId },
  });
  if (windows.length === 0) return null;

  const weekday = scheduledAt.getDay();
  const todaysWindows = windows.filter((w) => w.weekday === weekday);
  if (todaysWindows.length === 0) return "Doctor has no configured availability on this day of the week.";

  const minutesOfDay = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
  const withinAnyWindow = todaysWindows.some((w) => {
    const [startH, startM] = w.startTime.split(":").map(Number);
    const [endH, endM] = w.endTime.split(":").map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    return minutesOfDay >= start && minutesOfDay < end;
  });

  return withinAnyWindow ? null : "Requested time falls outside the doctor's configured availability window.";
}
