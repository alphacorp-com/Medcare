import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// Closes the appointment a stay was opened from (check-in links them via
// Appointment.stayId). Called when the consultation note is signed and, as a fallback,
// when the stay ends — whichever comes first; the status filter makes the second call
// a no-op. Accepts a transaction client so it can join the caller's transaction.
export async function completeAppointmentForStay(
  tenantId: string | null,
  stayId: string,
  db: Prisma.TransactionClient = prisma
): Promise<void> {
  await db.appointment.updateMany({
    where: { tenantId, stayId, status: "checked_in" },
    data: { status: "completed" },
  });
}
