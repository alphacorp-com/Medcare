import { NextResponse } from "next/server";
import { loadManualForm, saveManualValues } from "@/lib/rma3-manual/data";
import { parsePeriod, parseValueChanges } from "@/lib/rma3-manual/input";
import { auditRma3, badRequest, errorResponse, requireRma3Access } from "@/lib/rma3-manual/route-auth";

type Context = { params: Promise<{ period: string }> };

// ── GET /api/v1/rma3-entry/[period] ─────────────────────────────────────────
// The RMA3 monthly form of a period (YYYYMM): status and the values entered so far.
export async function GET(_request: Request, context: Context) {
  try {
    const guard = await requireRma3Access("read");
    if (!guard.ok) return guard.response;
    const period = parsePeriod((await context.params).period);
    if (!period.ok) return badRequest(period.error);
    return NextResponse.json({ data: await loadManualForm(guard.access.tenantId, period.value) });
  } catch (error) {
    return errorResponse(error, "GET");
  }
}

// ── PUT /api/v1/rma3-entry/[period] ─────────────────────────────────────────
// Body: { values: [{ code, key, value: integer | null }] } — only the changed cells. Refused
// (409 period_validated) once the month is validated.
export async function PUT(request: Request, context: Context) {
  try {
    const guard = await requireRma3Access("update");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const period = parsePeriod((await context.params).period);
    if (!period.ok) return badRequest(period.error);
    const body = await request.json().catch(() => null);
    const changes = parseValueChanges(body, period.value);
    if (!changes.ok) return badRequest(changes.error);

    await saveManualValues(access.tenantId, period.value, changes.value, access.userId);
    // Aggregate, non-nominative figures: the changed cells are logged with their values.
    await auditRma3(request, access, "rma3.values_update", period.value, { period: period.value, changes: changes.value });
    return NextResponse.json({ data: await loadManualForm(access.tenantId, period.value) });
  } catch (error) {
    return errorResponse(error, "PUT");
  }
}
