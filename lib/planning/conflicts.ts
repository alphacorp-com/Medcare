import prisma from "@/lib/prisma";

export interface ScheduleConflict {
  scheduleId: string;
  shiftType: string;
  status: string;
}

/**
 * Any other shift the same user already has on that date is a soft conflict —
 * a "replaced" row doesn't count, since someone else is actually covering it.
 */
export async function findScheduleConflicts(
  userId: string,
  date: Date,
  excludeId?: string
): Promise<ScheduleConflict[]> {
  const existing = await prisma.schedule.findMany({
    where: {
      userId,
      date,
      status: { not: "replaced" },
      id: excludeId ? { not: excludeId } : undefined,
    },
  });

  return existing.map((s) => ({ scheduleId: s.id, shiftType: s.shiftType, status: s.status }));
}
