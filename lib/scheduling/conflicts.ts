import prisma from "@/lib/prisma";
import { overlaps } from "@/lib/surgery/validation";

// Shared by every "is this resource already busy around this time" check in the app
// (surgery scheduling, appointment booking) — there's no stored end time for either,
// so a conflict is approximated as another active record for the same resource within
// a fixed buffer window around the requested start time.
export const DEFAULT_CONFLICT_WINDOW_MINUTES = 90;

export interface SurgeryConflictCheck {
  // Required: conflicts carry patient names back to the caller, so the lookup must never
  // reach another tenant's surgeries.
  tenantId: string | null;
  surgeonId: string;
  roomId?: string | null;
  scheduledAt: Date;
  // Planned length of the new booking (default 90 minutes).
  durationMinutes?: number;
  excludeId?: string;
}

export interface SurgeryConflict {
  resource: "surgeon" | "room";
  procedureId: string;
  procedureLabel: string;
  scheduledAt: string;
  patientName: string;
}

// Longest case considered when looking back for one still running at the requested time.
const MAX_SURGERY_MINUTES = 24 * 60;

// A surgery occupies its surgeon and room from scheduledAt to scheduledAt + its planned duration
// (90 minutes when none is given): two bookings conflict when these intervals overlap.
export async function findSurgeryConflicts({
  tenantId,
  surgeonId,
  roomId,
  scheduledAt,
  durationMinutes = DEFAULT_CONFLICT_WINDOW_MINUTES,
  excludeId,
}: SurgeryConflictCheck): Promise<SurgeryConflict[]> {
  const windowStart = new Date(scheduledAt.getTime() - MAX_SURGERY_MINUTES * 60_000);
  const windowEnd = new Date(scheduledAt.getTime() + durationMinutes * 60_000);

  const candidates = await prisma.surgicalProcedure.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      tenantId,
      status: { in: ["scheduled", "in_progress"] },
      scheduledAt: { gte: windowStart, lt: windowEnd },
      OR: [{ surgeonId }, ...(roomId ? [{ roomId }] : [])],
    },
    include: { patient: { select: { firstName: true, lastName: true } } },
  });

  const busy = candidates.filter(
    (c) => c.scheduledAt && overlaps(scheduledAt, durationMinutes, c.scheduledAt, c.expectedDurationMinutes ?? DEFAULT_CONFLICT_WINDOW_MINUTES)
  );
  return busy.map((c) => ({
    resource: c.surgeonId === surgeonId ? "surgeon" : "room",
    procedureId: c.id,
    procedureLabel: c.procedureLabel,
    scheduledAt: (c.scheduledAt ?? new Date()).toISOString(),
    patientName: `${c.patient.firstName} ${c.patient.lastName}`,
  }));
}

export interface AppointmentConflictCheck {
  // Required: conflicts carry patient names back to the caller, so the lookup must never
  // reach another tenant's appointments.
  tenantId: string | null;
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

export const ACTIVE_APPOINTMENT_STATUSES = ["booked", "confirmed", "checked_in"] as const;

export interface AppointmentConflictCandidate {
  id: string;
  scheduledAt: Date;
  patient: { firstName: string; lastName: string };
}

const conflictWindowMinutes = (durationMinutes: number) => Math.max(durationMinutes, DEFAULT_CONFLICT_WINDOW_MINUTES);

// Pure: the already-loaded active appointments of a doctor that fall within the conflict
// window around `scheduledAt`. Lets a whole recurring series be checked against one
// query instead of one query per occurrence.
export function appointmentConflictsAt(
  candidates: readonly AppointmentConflictCandidate[],
  scheduledAt: Date,
  durationMinutes = 30
): AppointmentConflict[] {
  const windowMs = conflictWindowMinutes(durationMinutes) * 60_000;
  return candidates
    .filter((c) => Math.abs(c.scheduledAt.getTime() - scheduledAt.getTime()) <= windowMs)
    .map((c) => ({
      appointmentId: c.id,
      scheduledAt: c.scheduledAt.toISOString(),
      patientName: `${c.patient.firstName} ${c.patient.lastName}`,
    }));
}

// Loads the doctor's active appointments that could conflict with any of `dates`.
export async function loadAppointmentConflictCandidates({
  tenantId,
  doctorId,
  dates,
  durationMinutes = 30,
  excludeId,
}: {
  tenantId: string | null;
  doctorId: string;
  dates: readonly Date[];
  durationMinutes?: number;
  excludeId?: string;
}): Promise<AppointmentConflictCandidate[]> {
  if (dates.length === 0) return [];
  const windowMs = conflictWindowMinutes(durationMinutes) * 60_000;
  const times = dates.map((d) => d.getTime());
  return prisma.appointment.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      tenantId,
      doctorId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      scheduledAt: { gte: new Date(Math.min(...times) - windowMs), lte: new Date(Math.max(...times) + windowMs) },
    },
    select: { id: true, scheduledAt: true, patient: { select: { firstName: true, lastName: true } } },
  });
}

export async function findAppointmentConflicts({
  tenantId,
  doctorId,
  scheduledAt,
  durationMinutes = 30,
  excludeId,
}: AppointmentConflictCheck): Promise<AppointmentConflict[]> {
  const candidates = await loadAppointmentConflictCandidates({ tenantId, doctorId, dates: [scheduledAt], durationMinutes, excludeId });
  return appointmentConflictsAt(candidates, scheduledAt, durationMinutes);
}

export interface AvailabilityWindow {
  weekday: number;
  startTime: string;
  endTime: string;
}

// Pure: checks the requested time against the doctor's configured weekly availability.
// Returns a human-readable reason when the slot falls outside every configured window
// for that weekday, or null when it's within bounds — or when the doctor has no
// availability configured at all (nothing to enforce yet).
export function availabilityIssueAt(windows: readonly AvailabilityWindow[], scheduledAt: Date): string | null {
  if (windows.length === 0) return null;

  const weekday = scheduledAt.getDay();
  const todaysWindows = windows.filter((w) => w.weekday === weekday);
  if (todaysWindows.length === 0) return "Doctor has no configured availability on this day of the week.";

  const minutesOfDay = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
  const withinAnyWindow = todaysWindows.some((w) => {
    const [startH, startM] = w.startTime.split(":").map(Number);
    const [endH, endM] = w.endTime.split(":").map(Number);
    return minutesOfDay >= startH * 60 + startM && minutesOfDay < endH * 60 + endM;
  });

  return withinAnyWindow ? null : "Requested time falls outside the doctor's configured availability window.";
}

export function loadAvailabilityWindows(tenantId: string | null | undefined, doctorId: string): Promise<AvailabilityWindow[]> {
  return prisma.doctorAvailability.findMany({
    where: { tenantId: tenantId ?? undefined, doctorId },
    select: { weekday: true, startTime: true, endTime: true },
  });
}

export async function findAvailabilityConflict(
  tenantId: string | null | undefined,
  doctorId: string,
  scheduledAt: Date
): Promise<string | null> {
  return availabilityIssueAt(await loadAvailabilityWindows(tenantId, doctorId), scheduledAt);
}
