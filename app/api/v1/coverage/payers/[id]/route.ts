import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parsePayer } from "@/lib/coverage/input";
import { isFacilityInsuranceType } from "@/lib/coverage/references";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, coverageError, handleCoverageError, settingsGuard } from "@/lib/coverage/route-auth";

// PATCH /api/v1/coverage/payers/[id] — any payer field; isActive=false suspends its conventions
// (open invoices lose the payer share).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await settingsGuard("write");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const payer = await prisma.payer.findFirst({ where: { id, tenantId: guard.tenantId } });
    if (!payer) return coverageError("not_found", 404);
    const parsed = parsePayer(await request.json().catch(() => null), { partial: true });
    if (!parsed.ok) return coverageError(parsed.error);
    if (!(await isFacilityInsuranceType(guard.tenantId, parsed.value.insuranceTypeId))) return coverageError("invalid_insurance_type");
    const updated = await prisma.payer.update({ where: { id }, data: parsed.value });
    if (parsed.value.isActive !== undefined && parsed.value.isActive !== payer.isActive) {
      await recalcOpenInvoices({ tenantId: guard.tenantId, coverage: { policy: { agreement: { payerId: id } } } });
    }
    await auditCoverage(request, guard, "coverage.payer_update", "payer", id, { changes: parsed.value });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/coverage/payers/[id]");
  }
}
