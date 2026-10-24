import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// PATCH /api/v1/patients/[id]/authorizations/[authorizationId] — Body: { status: "cancelled" }.
// The open invoices using it are recomputed (and lose the payer share if it was required).
export async function PATCH(request: Request, context: { params: Promise<{ id: string; authorizationId: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id, authorizationId } = await context.params;
    const authorization = await prisma.coverageAuthorization.findFirst({ where: { id: authorizationId, tenantId: guard.tenantId, coverage: { patientId: id } } });
    if (!authorization) return coverageError("not_found", 404);
    const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
    if (body?.status !== "cancelled") return coverageError("invalid_status");
    if (authorization.status === "cancelled") return coverageError("authorization_cancelled");
    await prisma.coverageAuthorization.update({ where: { id: authorizationId }, data: { status: "cancelled" } });
    // Detached from the open invoices, which may then pick another valid authorization.
    await prisma.patientInvoice.updateMany({
      where: { tenantId: guard.tenantId, authorizationId, status: { in: ["draft", "pending_payment", "partially_paid"] }, claimItems: { none: {} } },
      data: { authorizationId: null },
    });
    const recomputed = await recalcOpenInvoices({ tenantId: guard.tenantId, coverageId: authorization.coverageId });
    await auditCoverage(request, guard, "coverage.authorization_cancel", "coverage_authorization", authorizationId, { patientId: id, number: authorization.number, recomputedInvoices: recomputed });
    return NextResponse.json({ data: { id: authorizationId, status: "cancelled" } });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/patients/[id]/authorizations/[authorizationId]");
  }
}
