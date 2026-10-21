import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseEnrolment } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, patientInTenant, pregnancyInTenant, requireHivAccess } from "@/lib/hiv/route-auth";

const DAY = 86_400_000;

// ── GET /api/v1/hiv/enrolments ──────────────────────────────────────────────
// The ART cohort today: each enrolment with its last visit and the days late (from the
// next appointment), for the follow-up list. Lost to follow-up = 90 days late and more.
export async function GET() {
  try {
    const guard = await requireHivAccess("read");
    if (!guard.ok) return guard.response;
    const enrolments = await prisma.hivCareEnrolment.findMany({
      where: { tenantId: guard.access.tenantId },
      orderBy: { enrolledAt: "desc" },
      take: 1000,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, ipp: true, birthDate: true, gender: true } },
        visits: { orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }], take: 1 },
      },
    });
    const now = Date.now();
    return NextResponse.json({
      data: enrolments.map(({ visits, ...e }) => {
        const last = visits[0] ?? null;
        const due = (last?.nextAppointmentDate ?? e.enrolledAt).getTime();
        return { ...e, lastVisit: last, daysLate: e.status === "active" ? Math.max(0, Math.floor((now - due) / DAY)) : null };
      }),
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/hiv/enrolments]", error);
    return NextResponse.json({ error: "Failed to fetch the ART cohort", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/hiv/enrolments ─────────────────────────────────────────────
// Body: { patientId, artStartDate, enrolledAt?, hivDiagnosisDate?, entryPoint, transferIn?,
//         pregnancyId?, notes? } — one enrolment per patient.
export async function POST(request: Request) {
  try {
    const guard = await requireHivAccess("create");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return hivBadRequest("invalid_body");
    const parsed = parseEnrolment(body as Record<string, unknown>);
    if (!parsed.ok) return hivBadRequest(parsed.error);
    const v = parsed.value;
    if (!(await patientInTenant(access.tenantId, v.patientId))) return hivBadRequest("invalid_patient");
    if (v.pregnancyId && !(await pregnancyInTenant(access.tenantId, v.pregnancyId, v.patientId))) return hivBadRequest("invalid_pregnancy");
    const existing = await prisma.hivCareEnrolment.findFirst({ where: { tenantId: access.tenantId, patientId: v.patientId }, select: { id: true } });
    if (existing) return hivBadRequest("already_enrolled");

    const enrolment = await prisma.hivCareEnrolment.create({ data: { tenantId: access.tenantId, createdById: access.userId, ...v } });
    await auditHiv(request, access, "hiv.enrolment.create", "hiv_care_enrolment", enrolment.id, v.patientId);
    return NextResponse.json({ data: enrolment, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/hiv/enrolments]", error);
    return NextResponse.json({ error: "Failed to enrol the patient", success: false }, { status: 500 });
  }
}
