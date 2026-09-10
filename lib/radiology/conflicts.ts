import prisma from "@/lib/prisma";

const CONFLICT_WINDOW_MINUTES = 60;

export interface RadiologyConflict {
  examRequestId: string;
  examLabel: string;
  scheduledAt: string;
}

/**
 * There's no equipment/room field on ExamRequest (unlike SurgicalProcedure.roomId),
 * so true modality-machine double-booking isn't modeled. What IS checked: the same
 * patient can't be scheduled for two imaging exams at overlapping times.
 */
export async function findRadiologyConflicts(
  patientId: string,
  scheduledAt: Date,
  excludeId?: string
): Promise<RadiologyConflict[]> {
  const windowStart = new Date(scheduledAt.getTime() - CONFLICT_WINDOW_MINUTES * 60_000);
  const windowEnd = new Date(scheduledAt.getTime() + CONFLICT_WINDOW_MINUTES * 60_000);

  const candidates = await prisma.examRequest.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      patientId,
      type: "radiology",
      status: { in: ["scheduled", "in_progress"] },
      scheduledAt: { gte: windowStart, lte: windowEnd },
    },
  });

  return candidates.map((c) => ({
    examRequestId: c.id,
    examLabel: c.examLabel,
    scheduledAt: (c.scheduledAt ?? new Date()).toISOString(),
  }));
}
