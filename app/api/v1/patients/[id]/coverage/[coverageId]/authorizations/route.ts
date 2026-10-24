import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseAuthorization } from "@/lib/coverage/input";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// POST /api/v1/patients/[id]/coverage/[coverageId]/authorizations
// Body: { number, authorizedAmount?, validFrom, validTo, stayId?, notes? } — a prior authorization
// ("bon de prise en charge") received from the payer. The open invoices of this coverage are
// recomputed: those waiting for an authorization pick it up.
export async function POST(request: Request, context: { params: Promise<{ id: string; coverageId: string }> }) {
  try {
    const guard = await billingGuard("create");
    if (!guard.ok) return guard.response;
    const { id, coverageId } = await context.params;
    const coverage = await prisma.patientCoverage.findFirst({ where: { id: coverageId, tenantId: guard.tenantId, patientId: id }, select: { id: true, endedAt: true } });
    if (!coverage) return coverageError("not_found", 404);
    if (coverage.endedAt) return coverageError("coverage_ended");
    const parsed = parseAuthorization(await request.json().catch(() => null));
    if (!parsed.ok) return coverageError(parsed.error);
    if (parsed.value.stayId) {
      const stay = await prisma.stay.findFirst({ where: { id: parsed.value.stayId, tenantId: guard.tenantId, patientId: id }, select: { id: true } });
      if (!stay) return coverageError("invalid_stay");
    }
    const authorization = await prisma.coverageAuthorization.create({ data: { ...parsed.value, tenantId: guard.tenantId, coverageId, createdById: guard.userId } });
    const recomputed = await recalcOpenInvoices({ tenantId: guard.tenantId, coverageId });
    await auditCoverage(request, guard, "coverage.authorization_create", "coverage_authorization", authorization.id, { patientId: id, number: authorization.number, authorizedAmount: parsed.value.authorizedAmount, recomputedInvoices: recomputed });
    return NextResponse.json({ data: authorization }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/patients/[id]/coverage/[coverageId]/authorizations");
  }
}
