import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseChronicVisit } from "@/lib/programs/input-complements";
import { programError } from "@/lib/programs/route-helpers";

// POST /api/v1/chronic-care/enrolments/[id]/visits
// Body: { visitDate?, onTreatment?, systolic?, diastolic?, hba1c?, educationIndividual?, educationGroup? }
// Follow-up visit of an open enrolment.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireEpiAccess("create");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const enrolment = await prisma.chronicCareEnrolment.findFirst({ where: { id, tenantId: guard.tenantId }, select: { enrolledAt: true, exitedAt: true } });
  if (!enrolment) return programError("not_found", 404);
  if (enrolment.exitedAt) return programError("enrolment_closed", 409);
  const parsed = parseChronicVisit(await request.json().catch(() => null), enrolment.enrolledAt);
  if (!parsed.ok) return programError(parsed.error);
  const visit = await prisma.chronicCareVisit.create({ data: { ...parsed.value, tenantId: guard.tenantId, enrolmentId: id, recordedById: guard.userId } });
  return NextResponse.json({ data: visit }, { status: 201 });
}
