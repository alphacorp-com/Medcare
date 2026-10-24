import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseNutritionAdmission } from "@/lib/programs/input";
import { PATIENT_REF, patientInTenant, programError } from "@/lib/programs/route-helpers";

// GET /api/v1/nutrition/cases?active=true — acute malnutrition cases (PCIMA): the active ones
// (not discharged), or the 300 most recent.
export async function GET(request: Request) {
  const guard = await requireEpiAccess("read");
  if (!guard.ok) return guard.response;
  const active = new URL(request.url).searchParams.get("active") === "true";
  const cases = await prisma.nutritionCase.findMany({
    where: { tenantId: guard.tenantId, ...(active ? { exitedAt: null } : {}) },
    include: { patient: PATIENT_REF },
    orderBy: { admittedAt: "desc" },
    take: 300,
  });
  return NextResponse.json({ data: cases });
}

// POST /api/v1/nutrition/cases
// Body: { patientId, program (cna|cnti), admittedAt?, admissionType, criterion?, muacMm?, whz?,
//         residency?, hivTested?, anjeCounseling?, notes? }
// One open case per patient and programme at a time.
export async function POST(request: Request) {
  const guard = await requireEpiAccess("create");
  if (!guard.ok) return guard.response;
  const parsed = parseNutritionAdmission(await request.json().catch(() => null));
  if (!parsed.ok) return programError(parsed.error);
  const v = parsed.value;
  if (!(await patientInTenant(guard.tenantId, v.patientId))) return programError("invalid_patient");
  const open = await prisma.nutritionCase.findFirst({ where: { tenantId: guard.tenantId, patientId: v.patientId, program: v.program, exitedAt: null }, select: { id: true } });
  if (open) return programError("case_already_open", 409);
  const created = await prisma.nutritionCase.create({ data: { ...v, tenantId: guard.tenantId, recordedById: guard.userId }, include: { patient: PATIENT_REF } });
  return NextResponse.json({ data: created }, { status: 201 });
}
