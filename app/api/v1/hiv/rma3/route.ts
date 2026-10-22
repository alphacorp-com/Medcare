import { NextResponse } from "next/server";
import { monthRange } from "@/lib/epi/route-auth";
import { computeHivReport } from "@/lib/hiv/rma3-hiv-data";
import { hivBadRequest, requireHivAccess } from "@/lib/hiv/route-auth";

// ── GET /api/v1/hiv/rma3?month=YYYY-MM ──────────────────────────────────────
// The HIV / PMTCT / hepatitis / STI tables of the month with the full age × sex detail
// (the Word RMA3 prints them condensed). Aggregates only, MODULE_HIV.
export async function GET(request: Request) {
  try {
    const guard = await requireHivAccess("read");
    if (!guard.ok) return guard.response;
    const range = monthRange(new URL(request.url).searchParams.get("month"));
    if (!range) return hivBadRequest("invalid_month");
    const report = await computeHivReport(guard.access.tenantId, range.start, range.end);
    return NextResponse.json({ data: report, success: true });
  } catch (error) {
    console.error("[GET /api/v1/hiv/rma3]", error);
    return NextResponse.json({ error: "Failed to compute the report", success: false }, { status: 500 });
  }
}
