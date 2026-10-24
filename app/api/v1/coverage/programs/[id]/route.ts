import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseProgram } from "@/lib/coverage/input";
import { areFacilityArticles } from "@/lib/coverage/references";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, coverageError, handleCoverageError, settingsGuard } from "@/lib/coverage/route-auth";

// PATCH /api/v1/coverage/programs/[id] — any programme field (isActive=false stops it). The open
// invoices are recomputed.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await settingsGuard("write");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const program = await prisma.exemptionProgram.findFirst({ where: { id, tenantId: guard.tenantId } });
    if (!program) return coverageError("not_found", 404);
    const parsed = parseProgram(await request.json().catch(() => null), { partial: true });
    if (!parsed.ok) return coverageError(parsed.error);
    const v = parsed.value;
    if (!(await areFacilityArticles(guard.tenantId, v.inventoryItemIds))) return coverageError("invalid_articles");
    const min = v.minAgeMonths !== undefined ? v.minAgeMonths : program.minAgeMonths;
    const max = v.maxAgeMonths !== undefined ? v.maxAgeMonths : program.maxAgeMonths;
    if (min !== null && max !== null && min >= max) return coverageError("invalid_age");
    const from = v.validFrom !== undefined ? v.validFrom : program.validFrom;
    const to = v.validTo !== undefined ? v.validTo : program.validTo;
    if (from && to && from > to) return coverageError("invalid_dates");
    const updated = await prisma.exemptionProgram.update({ where: { id }, data: v });
    await recalcOpenInvoices(updated.eligibility === "automatic" || program.eligibility === "automatic" ? { tenantId: guard.tenantId } : { tenantId: guard.tenantId, patient: { exemptions: { some: { programId: id } } } });
    await auditCoverage(request, guard, "coverage.program_update", "exemption_program", id, { changes: v });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/coverage/programs/[id]");
  }
}
