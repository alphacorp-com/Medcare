import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isUuid } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, hivNotFound, requireHivAccess } from "@/lib/hiv/route-auth";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── PATCH /api/v1/hiv/screening-tests/:id ───────────────────────────────────
// Body: { resultCollectedAt?: YYYY-MM-DD, treatedAt?: YYYY-MM-DD } — follow-up of a test:
// result handed over, syphilis / STI treatment given (positive results only). The result
// itself is never edited: a wrong test is recorded again.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireHivAccess("update");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const { id } = await params;
    if (!isUuid(id)) return hivNotFound();
    const test = await prisma.screeningTest.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!test) return hivNotFound();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return hivBadRequest("invalid_body");
    const today = new Date().toISOString().slice(0, 10);
    const data: { resultCollectedAt?: Date; treatedAt?: Date } = {};
    for (const key of ["resultCollectedAt", "treatedAt"] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || !DATE_RE.test(value) || value > today) return hivBadRequest("invalid_date");
      const at = value === today ? new Date() : new Date(`${value}T12:00:00Z`);
      if (at.getTime() < test.testedAt.getTime() - 86_400_000) return hivBadRequest("date_order");
      data[key] = at;
    }
    if (data.treatedAt && test.result !== "positive") return hivBadRequest("invalid_result");
    if (Object.keys(data).length === 0) return hivBadRequest("invalid_body");

    const updated = await prisma.screeningTest.update({ where: { id: test.id }, data });
    await auditHiv(request, access, "hiv.screening_test.update", "screening_test", test.id, test.patientId);
    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/hiv/screening-tests/:id]", error);
    return NextResponse.json({ error: "Failed to update the test", success: false }, { status: 500 });
  }
}
