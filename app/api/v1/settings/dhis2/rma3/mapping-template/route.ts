import { mappingTemplateCsv } from "@/lib/dhis2/rma3-export";
import { buildRma3Export } from "@/lib/dhis2/rma3-sync";
import { failure, periodFrom, rma3Guard } from "@/lib/dhis2/rma3-route";

// GET /api/v1/settings/dhis2/rma3/mapping-template?period=YYYYMM — the CSV to fill in with the
// DHIS2 identifiers: one line per (indicator, cell) the report produces, already filled where a
// mapping exists. A BOM lets Excel read the accents.
export async function GET(request: Request) {
  const guard = await rma3Guard("heavy");
  if (!guard.ok) return guard.response;
  const parsed = periodFrom(new URL(request.url).searchParams.get("period"));
  if ("response" in parsed) return parsed.response;

  try {
    const built = await buildRma3Export(guard.tenantId, parsed.period);
    return new Response("﻿" + mappingTemplateCsv(built.values, built.mappings), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="rma3-dhis2-mapping.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error, "GET /api/v1/settings/dhis2/rma3/mapping-template");
  }
}
