import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isUuid } from "@/lib/hiv/input";
import { auditHiv, hivNotFound, patientInTenant, requireHivAccess } from "@/lib/hiv/route-auth";

// ── GET /api/v1/hiv/patients/:patientId ─────────────────────────────────────
// The patient's HIV / PMTCT / hepatitis / STI file: screening tests, ART enrolment and
// visits, viral loads, hepatitis cases, exposed-infant follow-up, PMTCT status of each
// pregnancy. Opening it is audited.
export async function GET(request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  try {
    const guard = await requireHivAccess("read");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const { patientId } = await params;
    if (!isUuid(patientId) || !(await patientInTenant(access.tenantId, patientId))) return hivNotFound();

    const tenantId = access.tenantId;
    const [tests, enrolment, viralLoads, hepatitisCases, exposedInfant, pregnancies] = await Promise.all([
      prisma.screeningTest.findMany({ where: { tenantId, patientId }, orderBy: { testedAt: "desc" } }),
      prisma.hivCareEnrolment.findFirst({
        where: { tenantId, patientId },
        include: { visits: { orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }] } },
      }),
      prisma.viralLoadResult.findMany({ where: { tenantId, patientId }, orderBy: { sampledAt: "desc" } }),
      prisma.hepatitisCase.findMany({ where: { tenantId, patientId }, orderBy: { diagnosedAt: "desc" } }),
      prisma.hivExposedInfant.findFirst({ where: { tenantId, patientId } }),
      prisma.pregnancy.findMany({
        where: { tenantId, patientId },
        orderBy: { lastMenstrualPeriod: "desc" },
        select: { id: true, lastMenstrualPeriod: true, expectedDueDate: true, status: true, referralSource: true, pmtctStatus: true },
      }),
    ]);

    await auditHiv(request, access, "hiv.patient_view", "patient", patientId, patientId);
    return NextResponse.json({ data: { tests, enrolment, viralLoads, hepatitisCases, exposedInfant, pregnancies }, success: true });
  } catch (error) {
    console.error("[GET /api/v1/hiv/patients/:patientId]", error);
    return NextResponse.json({ error: "Failed to load the program file", success: false }, { status: 500 });
  }
}
