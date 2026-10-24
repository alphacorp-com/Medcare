import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseAgreement } from "@/lib/coverage/input";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, coverageError, handleCoverageError, settingsGuard } from "@/lib/coverage/route-auth";

// PATCH /api/v1/coverage/agreements/[id] — any convention field; `rates` replaces the whole list.
// The open invoices under this convention are recomputed with the new terms.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await settingsGuard("write");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const agreement = await prisma.coverageAgreement.findFirst({ where: { id, tenantId: guard.tenantId }, select: { id: true, validFrom: true, validTo: true } });
    if (!agreement) return coverageError("not_found", 404);
    const parsed = parseAgreement(await request.json().catch(() => null), { partial: true });
    if (!parsed.ok) return coverageError(parsed.error);
    const { rates, payerId: _ignored, ...fields } = parsed.value;
    const from = fields.validFrom !== undefined ? fields.validFrom : agreement.validFrom;
    const to = fields.validTo !== undefined ? fields.validTo : agreement.validTo;
    if (from && to && from > to) return coverageError("invalid_dates");
    const updated = await prisma.$transaction(async (tx) => {
      if (rates) {
        await tx.coverageAgreementRate.deleteMany({ where: { agreementId: id } });
        await tx.coverageAgreementRate.createMany({ data: rates.map((r) => ({ ...r, agreementId: id, tenantId: guard.tenantId })) });
      }
      return tx.coverageAgreement.update({ where: { id }, data: fields, include: { rates: true } });
    });
    await recalcOpenInvoices({ tenantId: guard.tenantId, coverage: { policy: { agreementId: id } } });
    await auditCoverage(request, guard, "coverage.agreement_update", "coverage_agreement", id, { changes: parsed.value });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/coverage/agreements/[id]");
  }
}
