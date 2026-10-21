import prisma from "@/lib/prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Whether `doctorId` may be booked as the doctor of an appointment in this tenant:
// an active account of the same tenant whose role is a clinical provider — the same
// population GET /api/v1/doctors offers in the pickers. The id comes from the request
// body, so it must be checked server-side: otherwise any id (a non-clinical account,
// or a user of another tenant) could be attached to an appointment.
export async function isBookableDoctor(tenantId: string | null, doctorId: unknown): Promise<boolean> {
  if (!tenantId || typeof doctorId !== "string" || !UUID_RE.test(doctorId)) return false;
  const doctor = await prisma.tenantUser.findFirst({
    where: { id: doctorId, tenantId, isActive: true, role: { isClinicalProvider: true } },
    select: { id: true },
  });
  return doctor !== null;
}
