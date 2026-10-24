import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { monthRange, requireEpiAccess } from "@/lib/epi/route-auth";
import { parseTbScreening } from "@/lib/programs/input-complements";
import { PATIENT_REF, patientInTenant, programError } from "@/lib/programs/route-helpers";

// GET /api/v1/tb-screenings?month=YYYY-MM — active TB case finding of a month (RMA3 IV.3-001 to 005).
export async function GET(request: Request) {
  const guard = await requireEpiAccess("read");
  if (!guard.ok) return guard.response;
  const range = monthRange(new URL(request.url).searchParams.get("month"));
  if (!range) return programError("invalid_month");
  const screenings = await prisma.tbScreening.findMany({
    where: { tenantId: guard.tenantId, screenedAt: { gte: range.start, lt: range.end } },
    include: { patient: PATIENT_REF },
    orderBy: { screenedAt: "desc" },
    take: 1000,
  });
  return NextResponse.json({ data: screenings });
}

// POST /api/v1/tb-screenings
// Body: { patientId, screenedAt?, presumptive?, sentToLabAt?, testedAt?, testPositive?, tptStartedAt?, notes? }
export async function POST(request: Request) {
  const guard = await requireEpiAccess("create");
  if (!guard.ok) return guard.response;
  const parsed = parseTbScreening(await request.json().catch(() => null));
  if (!parsed.ok) return programError(parsed.error);
  if (!(await patientInTenant(guard.tenantId, parsed.value.patientId))) return programError("invalid_patient");
  const screening = await prisma.tbScreening.create({ data: { ...parsed.value, tenantId: guard.tenantId, recordedById: guard.userId }, include: { patient: PATIENT_REF } });
  return NextResponse.json({ data: screening }, { status: 201 });
}
