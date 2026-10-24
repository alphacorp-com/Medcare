import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { monthRange, requireEpiAccess } from "@/lib/epi/route-auth";
import { parseGrowthVisit } from "@/lib/programs/input";
import { PATIENT_REF, programError } from "@/lib/programs/route-helpers";

// GET /api/v1/nutrition/growth-visits?month=YYYY-MM — growth monitoring / infant feeding visits.
export async function GET(request: Request) {
  const guard = await requireEpiAccess("read");
  if (!guard.ok) return guard.response;
  const range = monthRange(new URL(request.url).searchParams.get("month"));
  if (!range) return programError("invalid_month");
  const visits = await prisma.growthMonitoringVisit.findMany({
    where: { tenantId: guard.tenantId, visitDate: { gte: range.start, lt: range.end } },
    include: { patient: PATIENT_REF },
    orderBy: { visitDate: "desc" },
    take: 1000,
  });
  return NextResponse.json({ data: visits });
}

// POST /api/v1/nutrition/growth-visits
// Body: { patientId, visitDate?, weightKg?, heightCm?, muacMm?, counseling?, exclusiveBreastfeeding?,
//         receivesWater?, complementaryFood?, stillBreastfed?, multivitaminGiven? }
// For children under 5 years.
export async function POST(request: Request) {
  const guard = await requireEpiAccess("create");
  if (!guard.ok) return guard.response;
  const parsed = parseGrowthVisit(await request.json().catch(() => null));
  if (!parsed.ok) return programError(parsed.error);
  const patient = await prisma.patient.findFirst({ where: { id: parsed.value.patientId, tenantId: guard.tenantId }, select: { birthDate: true } });
  if (!patient) return programError("invalid_patient");
  const fiveYears = new Date(patient.birthDate);
  fiveYears.setUTCFullYear(fiveYears.getUTCFullYear() + 5);
  if (parsed.value.visitDate >= fiveYears) return programError("child_over_5");
  const visit = await prisma.growthMonitoringVisit.create({ data: { ...parsed.value, tenantId: guard.tenantId, recordedById: guard.userId }, include: { patient: PATIENT_REF } });
  return NextResponse.json({ data: visit }, { status: 201 });
}
