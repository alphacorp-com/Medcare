import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseViralLoad } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, patientInTenant, pregnancyInTenant, requireHivAccess } from "@/lib/hiv/route-auth";

// ── POST /api/v1/hiv/viral-loads ────────────────────────────────────────────
// Body: { patientId, program: hiv|hbv|hcv, sampledAt, value? | belowDetection: true, pregnancyId? }
export async function POST(request: Request) {
  try {
    const guard = await requireHivAccess("create");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return hivBadRequest("invalid_body");
    const parsed = parseViralLoad(body as Record<string, unknown>);
    if (!parsed.ok) return hivBadRequest(parsed.error);
    const v = parsed.value;
    if (!(await patientInTenant(access.tenantId, v.patientId))) return hivBadRequest("invalid_patient");
    if (v.pregnancyId && !(await pregnancyInTenant(access.tenantId, v.pregnancyId, v.patientId))) return hivBadRequest("invalid_pregnancy");

    const result = await prisma.viralLoadResult.create({ data: { tenantId: access.tenantId, recordedById: access.userId, ...v } });
    await auditHiv(request, access, "hiv.viral_load.create", "viral_load_result", result.id, v.patientId);
    return NextResponse.json({ data: result, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/hiv/viral-loads]", error);
    return NextResponse.json({ error: "Failed to record the viral load", success: false }, { status: 500 });
  }
}
