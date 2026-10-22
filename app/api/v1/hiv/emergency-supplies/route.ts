import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseEmergencySupply } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, patientInTenant, requireHivAccess } from "@/lib/hiv/route-auth";

// ── POST /api/v1/hiv/emergency-supplies ─────────────────────────────────────
// Body: { patientId, supplyDate?, regimenCode, daysDispensed, originSite } — ARVs served once
// to a patient followed at another site. No enrolment: the patient does not enter this
// facility's active file (RMA3 IV.1.2-024 only). A patient enrolled here gets a visit instead.
export async function POST(request: Request) {
  try {
    const guard = await requireHivAccess("create");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return hivBadRequest("invalid_body");
    const parsed = parseEmergencySupply(body as Record<string, unknown>);
    if (!parsed.ok) return hivBadRequest(parsed.error);
    const v = parsed.value;
    if (!(await patientInTenant(access.tenantId, v.patientId))) return hivBadRequest("invalid_patient");
    const enrolment = await prisma.hivCareEnrolment.findFirst({ where: { tenantId: access.tenantId, patientId: v.patientId, status: "active" }, select: { id: true } });
    if (enrolment) return hivBadRequest("enrolled_here");

    const supply = await prisma.artEmergencySupply.create({ data: { tenantId: access.tenantId, recordedById: access.userId, ...v } });
    await auditHiv(request, access, "hiv.emergency_supply.create", "art_emergency_supply", supply.id, v.patientId);
    return NextResponse.json({ data: supply, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/hiv/emergency-supplies]", error);
    return NextResponse.json({ error: "Failed to record the emergency supply", success: false }, { status: 500 });
  }
}
