import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseChronicExit } from "@/lib/programs/input-complements";
import { programError } from "@/lib/programs/route-helpers";

// PATCH /api/v1/chronic-care/enrolments/[id] — Body: { exitReason? (lost_to_follow_up|transferred|
// died|other, null to reopen), exitedAt? } — exit from the programme.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireEpiAccess("update");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const enrolment = await prisma.chronicCareEnrolment.findFirst({ where: { id, tenantId: guard.tenantId }, select: { enrolledAt: true, patientId: true, condition: true } });
  if (!enrolment) return programError("not_found", 404);
  const parsed = parseChronicExit(await request.json().catch(() => null), enrolment.enrolledAt);
  if (!parsed.ok) return programError(parsed.error);
  // Reopening must not leave two open enrolments for the same patient and condition.
  if (parsed.value.exitReason === null) {
    const open = await prisma.chronicCareEnrolment.findFirst({
      where: { tenantId: guard.tenantId, patientId: enrolment.patientId, condition: enrolment.condition, exitedAt: null, id: { not: id } },
      select: { id: true },
    });
    if (open) return programError("already_enrolled", 409);
  }
  const updated = await prisma.chronicCareEnrolment.update({ where: { id }, data: parsed.value });
  return NextResponse.json({ data: updated });
}
