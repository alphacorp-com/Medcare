import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseExposedInfant } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, patientInTenant, requireHivAccess } from "@/lib/hiv/route-auth";

// ── GET /api/v1/hiv/exposed-infants ─────────────────────────────────────────
// Children born to HIV-positive mothers under follow-up, with their PCR / serology tests.
export async function GET() {
  try {
    const guard = await requireHivAccess("read");
    if (!guard.ok) return guard.response;
    const tenantId = guard.access.tenantId;
    const infants = await prisma.hivExposedInfant.findMany({
      where: { tenantId },
      orderBy: { firstSeenAt: "desc" },
      take: 500,
      include: { patient: { select: { id: true, firstName: true, lastName: true, ipp: true, birthDate: true, gender: true } } },
    });
    const tests = await prisma.screeningTest.findMany({
      where: { tenantId, patientId: { in: infants.map((i) => i.patientId) }, testType: { in: ["hiv_pcr", "hiv"] } },
      orderBy: { testedAt: "asc" },
      select: { patientId: true, testType: true, testedAt: true, result: true },
    });
    return NextResponse.json({
      data: infants.map((i) => ({ ...i, tests: tests.filter((t) => t.patientId === i.patientId) })),
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/hiv/exposed-infants]", error);
    return NextResponse.json({ error: "Failed to fetch exposed infants", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/hiv/exposed-infants ────────────────────────────────────────
// Creates or updates the follow-up of a child (one per child).
export async function POST(request: Request) {
  try {
    const guard = await requireHivAccess("create");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return hivBadRequest("invalid_body");
    const parsed = parseExposedInfant(body as Record<string, unknown>);
    if (!parsed.ok) return hivBadRequest(parsed.error);
    const v = parsed.value;
    const child = await patientInTenant(access.tenantId, v.patientId);
    if (!child) return hivBadRequest("invalid_patient");
    if (v.motherPatientId && !(await patientInTenant(access.tenantId, v.motherPatientId))) return hivBadRequest("invalid_patient");
    if (v.firstSeenAt < child.birthDate) return hivBadRequest("date_order");

    const existing = await prisma.hivExposedInfant.findFirst({ where: { tenantId: access.tenantId, patientId: v.patientId }, select: { id: true } });
    const infant = existing
      ? await prisma.hivExposedInfant.update({ where: { id: existing.id }, data: v })
      : await prisma.hivExposedInfant.create({ data: { tenantId: access.tenantId, createdById: access.userId, ...v } });
    await auditHiv(request, access, existing ? "hiv.exposed_infant.update" : "hiv.exposed_infant.create", "hiv_exposed_infant", infant.id, v.patientId);
    return NextResponse.json({ data: infant, success: true }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("[POST /api/v1/hiv/exposed-infants]", error);
    return NextResponse.json({ error: "Failed to save the follow-up", success: false }, { status: 500 });
  }
}
