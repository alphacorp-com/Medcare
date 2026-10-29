import { NextResponse } from "next/server";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";
import { pushRma3 } from "@/lib/dhis2/rma3-sync";
import { failure, periodFrom, rma3Guard } from "@/lib/dhis2/rma3-route";

// POST /api/v1/settings/dhis2/rma3/push — Body: { period, dryRun? }. Sends the month's mapped
// RMA3 values to DHIS2 through its API. `dryRun: true` asks DHIS2 to validate and count without
// saving anything (any month); a real push needs the monthly form validated (409 otherwise).
export async function POST(request: Request) {
  const guard = await rma3Guard("heavy");
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => null)) as { period?: string; dryRun?: boolean } | null;
  const parsed = periodFrom(body?.period);
  if ("response" in parsed) return parsed.response;
  const dryRun = body?.dryRun === true;

  try {
    const result = await pushRma3(guard.tenantId, parsed.period, { dryRun });
    await recordAuditEvent({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorType: "tenant_user",
      action: "dhis2.rma3_push",
      resourceType: "dhis2_rma3",
      resourceId: parsed.period,
      payload: { period: parsed.period, dryRun, ok: result.ok, sent: result.sent, importCount: result.importCount, conflicts: result.conflicts.length, error: result.error ?? null },
      ...extractRequestMeta(request.headers),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return failure(error, "POST /api/v1/settings/dhis2/rma3/push");
  }
}
