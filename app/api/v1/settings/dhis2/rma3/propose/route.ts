import { NextResponse } from "next/server";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";
import { proposeRma3Mappings, saveRma3Mappings } from "@/lib/dhis2/rma3-sync";
import { failure, periodFrom, rma3Guard } from "@/lib/dhis2/rma3-route";

const PREVIEW = 30;

// POST /api/v1/settings/dhis2/rma3/propose — Body: { period, apply? }. Reads the structure of the
// configured national data set through the DHIS2 API and matches what it can with certainty
// (exact codes and names only). Without `apply` it only previews; with it, the proposals are
// saved. The proposals are recomputed here from DHIS2 and the registers, never taken from the browser.
export async function POST(request: Request) {
  const guard = await rma3Guard("heavy");
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => null)) as { period?: string; apply?: boolean } | null;
  const parsed = periodFrom(body?.period);
  if ("response" in parsed) return parsed.response;

  try {
    const result = await proposeRma3Mappings(guard.tenantId, parsed.period);
    if (body?.apply === true && result.proposals.length > 0) {
      await saveRma3Mappings(guard.tenantId, guard.userId, result.proposals, "dhis2");
      await recordAuditEvent({
        tenantId: guard.tenantId,
        actorId: guard.userId,
        actorType: "tenant_user",
        action: "dhis2.rma3_mappings_proposed",
        resourceType: "dhis2_rma3",
        payload: { period: parsed.period, applied: result.proposals.length },
        ...extractRequestMeta(request.headers),
      });
    }
    return NextResponse.json({
      applied: body?.apply === true ? result.proposals.length : 0,
      proposals: result.proposals.length,
      elements: result.elements,
      cells: result.cells,
      noElement: result.noElement,
      ambiguousElement: result.ambiguousElement,
      noCombo: result.noCombo,
      sample: result.proposals.slice(0, PREVIEW).map((p) => ({ indicatorCode: p.indicatorCode, cellKey: p.cellKey, elementName: p.elementName, comboName: p.comboName })),
    });
  } catch (error) {
    // The DHIS2 server's own messages (network errors, HTTP status) are not relayed as such.
    if (error instanceof Error && /DHIS2 data set lookup failed/.test(error.message)) return NextResponse.json({ error: "dhis2_unreachable", detail: error.message }, { status: 502 });
    return failure(error, "POST /api/v1/settings/dhis2/rma3/propose");
  }
}
