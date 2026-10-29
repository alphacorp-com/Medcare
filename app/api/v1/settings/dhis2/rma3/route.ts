import { NextResponse } from "next/server";
import { dictionaryCoverage } from "@/lib/dhis2/rma3-dictionary";
import { buildRma3Export } from "@/lib/dhis2/rma3-sync";
import { failure, periodFrom, rma3Guard } from "@/lib/dhis2/rma3-route";

const UNMAPPED_PREVIEW = 100;

// GET /api/v1/settings/dhis2/rma3?period=YYYYMM — what the RMA3 of the month would send to DHIS2:
// how many values, how many have a DHIS2 target, what is still unmapped, and how much of the
// 955-indicator dictionary the report produces at all. Computed from the registers, read-only.
export async function GET(request: Request) {
  const guard = await rma3Guard("read");
  if (!guard.ok) return guard.response;
  const parsed = periodFrom(new URL(request.url).searchParams.get("period"));
  if ("response" in parsed) return parsed.response;

  try {
    const built = await buildRma3Export(guard.tenantId, parsed.period);
    return NextResponse.json({
      period: built.period,
      manualStatus: built.manualStatus,
      target: built.target,
      coverage: built.coverage,
      dictionary: dictionaryCoverage(built.values.map((v) => v.indicatorCode)),
      values: built.values.length,
      toSend: built.dataValues.length,
      unmappedCount: built.unmapped.length,
      unmapped: built.unmapped.slice(0, UNMAPPED_PREVIEW).map((v) => ({ indicatorCode: v.indicatorCode, label: v.label, tableKey: v.tableKey, cellKey: v.cellKey, cellLabel: v.cellLabel })),
      collisions: built.collisions.map((c) => ({ first: `${c.first.indicatorCode}/${c.first.cellKey}`, second: `${c.second.indicatorCode}/${c.second.cellKey}` })).slice(0, 20),
      duplicates: built.duplicates.length,
      mappingsCount: built.mappings.length,
    });
  } catch (error) {
    return failure(error, "GET /api/v1/settings/dhis2/rma3");
  }
}
