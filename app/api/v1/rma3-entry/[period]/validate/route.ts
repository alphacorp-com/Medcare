import { NextResponse } from "next/server";
import { loadManualForm, validateManualPeriod } from "@/lib/rma3-manual/data";
import { parsePeriod } from "@/lib/rma3-manual/input";
import { auditRma3, badRequest, errorResponse, requireRma3Access } from "@/lib/rma3-manual/route-auth";

// ── POST /api/v1/rma3-entry/[period]/validate ───────────────────────────────
// Locks the month (MODULE_RMA3 validate): no value can change until an admin reopens it.
export async function POST(request: Request, context: { params: Promise<{ period: string }> }) {
  try {
    const guard = await requireRma3Access("validate");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const period = parsePeriod((await context.params).period);
    if (!period.ok) return badRequest(period.error);

    await validateManualPeriod(access.tenantId, period.value, access.userId);
    await auditRma3(request, access, "rma3.period_validate", period.value, { period: period.value });
    return NextResponse.json({ data: await loadManualForm(access.tenantId, period.value) });
  } catch (error) {
    return errorResponse(error, "POST validate");
  }
}
