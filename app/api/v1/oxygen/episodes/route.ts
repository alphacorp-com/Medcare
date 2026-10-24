import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { monthRange, requireEpiAccess } from "@/lib/epi/route-auth";
import { parseHypoxemiaEpisode } from "@/lib/programs/input";
import { PATIENT_REF, patientInTenant, programError } from "@/lib/programs/route-helpers";

// GET /api/v1/oxygen/episodes?month=YYYY-MM — hypoxaemia / respiratory distress episodes.
export async function GET(request: Request) {
  const guard = await requireEpiAccess("read");
  if (!guard.ok) return guard.response;
  const range = monthRange(new URL(request.url).searchParams.get("month"));
  if (!range) return programError("invalid_month");
  const episodes = await prisma.hypoxemiaEpisode.findMany({
    where: { tenantId: guard.tenantId, detectedAt: { gte: range.start, lt: range.end } },
    include: { patient: PATIENT_REF },
    orderBy: { detectedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ data: episodes });
}

// POST /api/v1/oxygen/episodes
// Body: { patientId, detectedAt?, spo2?, respiratoryDistress?, deliveryRoom?, oxygenGiven?, notes? }
// An episode is a hypoxaemia (SpO2 < 90 %) or a respiratory distress.
export async function POST(request: Request) {
  const guard = await requireEpiAccess("create");
  if (!guard.ok) return guard.response;
  const parsed = parseHypoxemiaEpisode(await request.json().catch(() => null));
  if (!parsed.ok) return programError(parsed.error);
  if (!(await patientInTenant(guard.tenantId, parsed.value.patientId))) return programError("invalid_patient");
  const episode = await prisma.hypoxemiaEpisode.create({
    data: { ...parsed.value, tenantId: guard.tenantId, recordedById: guard.userId },
    include: { patient: PATIENT_REF },
  });
  return NextResponse.json({ data: episode }, { status: 201 });
}
