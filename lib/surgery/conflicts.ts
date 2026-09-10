import prisma from "@/lib/prisma";

const CONFLICT_WINDOW_MINUTES = 90;

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

/**
 * There's no stored procedure duration, so "conflict" is approximated as
 * another active case for the same surgeon or room within a fixed buffer
 * window around the requested start time.
 */
export async function findSurgeryConflicts({
  surgeonId,
  roomId,
  scheduledAt,
  excludeId,
}: SurgeryConflictCheck): Promise<SurgeryConflict[]> {
  const windowStart = new Date(scheduledAt.getTime() - CONFLICT_WINDOW_MINUTES * 60_000);
  const windowEnd = new Date(scheduledAt.getTime() + CONFLICT_WINDOW_MINUTES * 60_000);

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
