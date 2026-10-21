import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isUuid, parseArtVisit } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, hivNotFound, requireHivAccess } from "@/lib/hiv/route-auth";

// ── POST /api/v1/hiv/enrolments/:id/visits ──────────────────────────────────
// Body: { visitDate?, regimenCode, daysDispensed, nextAppointmentDate?, isEmergencySupply?,
//         tbScreened?, tbSymptomsPositive?, tbTested?, tbConfirmed?, tbTreatmentStarted?,
//         iptStarted?, notes? } — one ART pick-up. Only an active enrolment receives visits.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireHivAccess("create");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const { id } = await params;
    if (!isUuid(id)) return hivNotFound();
    const enrolment = await prisma.hivCareEnrolment.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!enrolment) return hivNotFound();
    if (enrolment.status !== "active") return hivBadRequest("enrolment_not_active");

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return hivBadRequest("invalid_body");
    const parsed = parseArtVisit(body as Record<string, unknown>);
    if (!parsed.ok) return hivBadRequest(parsed.error);
    if (parsed.value.visitDate < enrolment.enrolledAt) return hivBadRequest("date_order");

    const visit = await prisma.artVisit.create({
      data: { tenantId: access.tenantId, enrolmentId: enrolment.id, recordedById: access.userId, ...parsed.value },
    });
    await auditHiv(request, access, "hiv.art_visit.create", "art_visit", visit.id, enrolment.patientId);
    return NextResponse.json({ data: visit, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/hiv/enrolments/:id/visits]", error);
    return NextResponse.json({ error: "Failed to record the visit", success: false }, { status: 500 });
  }
}
