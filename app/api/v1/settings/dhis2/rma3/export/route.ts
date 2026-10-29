import { NextResponse } from "next/server";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";
import { buildDataValueSet, dataValuesToCsv } from "@/lib/dhis2/rma3-export";
import { buildRma3Export } from "@/lib/dhis2/rma3-sync";
import { failure, periodFrom, rma3Guard } from "@/lib/dhis2/rma3-route";

// GET /api/v1/settings/dhis2/rma3/export?period=YYYYMM&format=json|csv — the file a district (or
// the DHIS2 import screen) can load when the API is not available to the facility. It holds
// exactly what the API push would send: the mapped values, in DHIS2's own import formats.
// Works on a month still open (a draft): the push, not the file, requires the validated form.
export async function GET(request: Request) {
  const guard = await rma3Guard("heavy");
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const parsed = periodFrom(url.searchParams.get("period"));
  if ("response" in parsed) return parsed.response;
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  try {
    const built = await buildRma3Export(guard.tenantId, parsed.period);
    if (!built.target?.orgUnitId) return NextResponse.json({ error: "dhis2_target_missing" }, { status: 400 });
    if (built.dataValues.length === 0) return NextResponse.json({ error: "nothing_mapped" }, { status: 400 });

    await recordAuditEvent({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorType: "tenant_user",
      action: "dhis2.rma3_export",
      resourceType: "dhis2_rma3",
      resourceId: parsed.period,
      payload: { period: parsed.period, format, values: built.dataValues.length, unmapped: built.unmapped.length },
      ...extractRequestMeta(request.headers),
    });

    const fileName = `rma3-dhis2-${parsed.period}.${format}`;
    const body =
      format === "csv"
        ? dataValuesToCsv({ orgUnitId: built.target.orgUnitId, period: parsed.period, dataValues: built.dataValues })
        : JSON.stringify(buildDataValueSet({ dataSetId: built.target.dataSetId, orgUnitId: built.target.orgUnitId, period: parsed.period, dataValues: built.dataValues }), null, 2);
    return new Response(body, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error, "GET /api/v1/settings/dhis2/rma3/export");
  }
}
