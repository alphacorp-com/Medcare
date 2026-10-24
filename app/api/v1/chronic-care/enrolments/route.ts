import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseChronicEnrolment } from "@/lib/programs/input-complements";
import { PATIENT_REF, patientInTenant, programError } from "@/lib/programs/route-helpers";

// GET /api/v1/chronic-care/enrolments?active=true — patients followed for diabetes / hypertension
// (RMA3 IV.4.1, IV.4.4), with their last visit.
export async function GET(request: Request) {
  const guard = await requireEpiAccess("read");
  if (!guard.ok) return guard.response;
  const active = new URL(request.url).searchParams.get("active") === "true";
  const enrolments = await prisma.chronicCareEnrolment.findMany({
    where: { tenantId: guard.tenantId, ...(active ? { exitedAt: null } : {}) },
    include: { patient: PATIENT_REF, visits: { orderBy: { visitDate: "desc" }, take: 1 } },
    orderBy: { enrolledAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ data: enrolments });
}

// POST /api/v1/chronic-care/enrolments — Body: { patientId, condition (diabetes|hypertension), enrolledAt?, notes? }
// One open enrolment per patient and condition.
export async function POST(request: Request) {
  const guard = await requireEpiAccess("create");
  if (!guard.ok) return guard.response;
  const parsed = parseChronicEnrolment(await request.json().catch(() => null));
  if (!parsed.ok) return programError(parsed.error);
  const v = parsed.value;
  if (!(await patientInTenant(guard.tenantId, v.patientId))) return programError("invalid_patient");
  const open = await prisma.chronicCareEnrolment.findFirst({ where: { tenantId: guard.tenantId, patientId: v.patientId, condition: v.condition, exitedAt: null }, select: { id: true } });
  if (open) return programError("already_enrolled", 409);
  const enrolment = await prisma.chronicCareEnrolment.create({ data: { ...v, tenantId: guard.tenantId, recordedById: guard.userId }, include: { patient: PATIENT_REF } });
  return NextResponse.json({ data: enrolment }, { status: 201 });
}
