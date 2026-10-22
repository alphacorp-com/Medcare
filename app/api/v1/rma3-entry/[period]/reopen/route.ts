import { NextResponse } from "next/server";
import { loadManualForm, reopenManualPeriod } from "@/lib/rma3-manual/data";
import { parsePeriod, parseReopenReason } from "@/lib/rma3-manual/input";
import { auditRma3, badRequest, errorResponse, requireRma3Admin } from "@/lib/rma3-manual/route-auth";

// ── POST /api/v1/rma3-entry/[period]/reopen ─────────────────────────────────
// Body: { reason } (5-500 characters). Tenant administrators only: puts a validated month
// back to draft; the reason is kept in the audit log.
export async function POST(request: Request, context: { params: Promise<{ period: string }> }) {
  try {
    const guard = await requireRma3Admin();
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const period = parsePeriod((await context.params).period);
    if (!period.ok) return badRequest(period.error);
    const reason = parseReopenReason(await request.json().catch(() => null));
    if (!reason.ok) return badRequest(reason.error);

    await reopenManualPeriod(access.tenantId, period.value);
    await auditRma3(request, access, "rma3.period_reopen", period.value, { period: period.value, reason: reason.value });
    return NextResponse.json({ data: await loadManualForm(access.tenantId, period.value) });
  } catch (error) {
    return errorResponse(error, "POST reopen");
  }
}
