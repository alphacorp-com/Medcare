import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

const toNumber = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// POST /api/v1/maternity/pregnancies/[id]/visits
// Body: { gestationalAgeWeeks, bloodPressureSystolic?, bloodPressureDiastolic?, weight?,
//         fundalHeightCm?, fetalHeartRate?, ironFolateGiven?, tetanusVaccineGiven?,
//         malariaPreventionGiven?, notes? }
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "create");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const pregnancy = await prisma.pregnancy.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!pregnancy) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });

    const body = await req.json();
    const { gestationalAgeWeeks } = body as { gestationalAgeWeeks?: number };
    if (gestationalAgeWeeks === undefined || gestationalAgeWeeks === null) {
      return NextResponse.json({ error: "gestationalAgeWeeks is required" }, { status: 400 });
    }

    const visitCount = await prisma.antenatalVisit.count({ where: { pregnancyId: id } });

    const visit = await prisma.antenatalVisit.create({
      data: {
        tenantId: session.user.tenantId,
        pregnancyId: id,
        visitNumber: visitCount + 1,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        performedById: session.user.id,
        bloodPressureSystolic: toNumber(body.bloodPressureSystolic),
        bloodPressureDiastolic: toNumber(body.bloodPressureDiastolic),
        weight: toNumber(body.weight),
        fundalHeightCm: toNumber(body.fundalHeightCm),
        fetalHeartRate: toNumber(body.fetalHeartRate),
        ironFolateGiven: Boolean(body.ironFolateGiven),
        tetanusVaccineGiven: Boolean(body.tetanusVaccineGiven),
        malariaPreventionGiven: Boolean(body.malariaPreventionGiven),
        notes: body.notes || null,
      },
    });

    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    console.error("Error creating antenatal visit:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
