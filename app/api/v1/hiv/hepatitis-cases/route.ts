import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseHepatitisCase } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, patientInTenant, requireHivAccess } from "@/lib/hiv/route-auth";

// ── GET /api/v1/hiv/hepatitis-cases ─────────────────────────────────────────
export async function GET() {
  try {
    const guard = await requireHivAccess("read");
    if (!guard.ok) return guard.response;
    const cases = await prisma.hepatitisCase.findMany({
      where: { tenantId: guard.access.tenantId },
      orderBy: { diagnosedAt: "desc" },
      take: 500,
      include: { patient: { select: { id: true, firstName: true, lastName: true, ipp: true } } },
    });
    return NextResponse.json({ data: cases, success: true });
  } catch (error) {
    console.error("[GET /api/v1/hiv/hepatitis-cases]", error);
    return NextResponse.json({ error: "Failed to fetch hepatitis cases", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/hiv/hepatitis-cases ────────────────────────────────────────
// Creates or updates the hepatitis B or C case of a patient (one per patient and type):
// diagnosis, delta, eligibility, treatment, cure, complications, death.
export async function POST(request: Request) {
  try {
    const guard = await requireHivAccess("create");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return hivBadRequest("invalid_body");
    const parsed = parseHepatitisCase(body as Record<string, unknown>);
    if (!parsed.ok) return hivBadRequest(parsed.error);
    const v = parsed.value;
    if (!(await patientInTenant(access.tenantId, v.patientId))) return hivBadRequest("invalid_patient");

    const existing = await prisma.hepatitisCase.findFirst({ where: { tenantId: access.tenantId, patientId: v.patientId, type: v.type }, select: { id: true } });
    const record = await prisma.$transaction(async (tx) => {
      if (v.diedAt) {
        await tx.patient.updateMany({ where: { id: v.patientId, tenantId: access.tenantId, isDeceased: false }, data: { isDeceased: true, deceasedAt: v.diedAt } });
      }
      return existing
        ? tx.hepatitisCase.update({ where: { id: existing.id }, data: v })
        : tx.hepatitisCase.create({ data: { tenantId: access.tenantId, createdById: access.userId, ...v } });
    });
    await auditHiv(request, access, existing ? "hiv.hepatitis_case.update" : "hiv.hepatitis_case.create", "hepatitis_case", record.id, v.patientId);
    return NextResponse.json({ data: record, success: true }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("[POST /api/v1/hiv/hepatitis-cases]", error);
    return NextResponse.json({ error: "Failed to save the hepatitis case", success: false }, { status: 500 });
  }
}
