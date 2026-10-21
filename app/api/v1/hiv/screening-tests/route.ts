import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { SCREENING_TEST_TYPES, parseScreeningTest, type ScreeningTestType } from "@/lib/hiv/input";
import { monthRange } from "@/lib/epi/route-auth";
import { auditHiv, hivBadRequest, patientInTenant, pregnancyInTenant, requireHivAccess } from "@/lib/hiv/route-auth";

// ── GET /api/v1/hiv/screening-tests?month=YYYY-MM&testType= ─────────────────
// The screening register of the month.
export async function GET(request: Request) {
  try {
    const guard = await requireHivAccess("read");
    if (!guard.ok) return guard.response;
    const params = new URL(request.url).searchParams;
    const range = monthRange(params.get("month"));
    if (!range) return hivBadRequest("invalid_month");
    const testType = params.get("testType");
    if (testType && !(SCREENING_TEST_TYPES as readonly string[]).includes(testType)) return hivBadRequest("invalid_test_type");

    const tests = await prisma.screeningTest.findMany({
      where: {
        tenantId: guard.access.tenantId,
        testedAt: { gte: range.start, lt: range.end },
        ...(testType ? { testType: testType as ScreeningTestType } : {}),
      },
      orderBy: { testedAt: "desc" },
      take: 500,
      include: { patient: { select: { id: true, firstName: true, lastName: true, ipp: true } } },
    });
    return NextResponse.json({ data: tests, success: true });
  } catch (error) {
    console.error("[GET /api/v1/hiv/screening-tests]", error);
    return NextResponse.json({ error: "Failed to fetch the register", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/hiv/screening-tests ────────────────────────────────────────
// A test done outside the lab (rapid test at ANC, delivery room, VCT…). Lab tests reach the
// register automatically when validated (lib/hiv/lab-link).
export async function POST(request: Request) {
  try {
    const guard = await requireHivAccess("create");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return hivBadRequest("invalid_body");
    const parsed = parseScreeningTest(body as Record<string, unknown>);
    if (!parsed.ok) return hivBadRequest(parsed.error);
    const v = parsed.value;

    if (!(await patientInTenant(access.tenantId, v.patientId))) return hivBadRequest("invalid_patient");
    if (v.pregnancyId && !(await pregnancyInTenant(access.tenantId, v.pregnancyId, v.patientId))) return hivBadRequest("invalid_pregnancy");
    if (v.partnerOfPregnancyId) {
      const pregnancy = await pregnancyInTenant(access.tenantId, v.partnerOfPregnancyId);
      if (!pregnancy || pregnancy.patientId === v.patientId) return hivBadRequest("invalid_pregnancy");
    }

    const test = await prisma.screeningTest.create({ data: { tenantId: access.tenantId, recordedById: access.userId, ...v } });
    await auditHiv(request, access, "hiv.screening_test.create", "screening_test", test.id, v.patientId);
    return NextResponse.json({ data: test, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/hiv/screening-tests]", error);
    return NextResponse.json({ error: "Failed to record the test", success: false }, { status: 500 });
  }
}
