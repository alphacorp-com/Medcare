import { NextRequest, NextResponse } from "next/server";
import { runRma3AutoSendForAllTenants } from "@/lib/dhis2/sync";

/**
 * GET /api/cron/sync-dhis2
 *
 * Sends to DHIS2, through its API, every validated RMA3 month not sent since its validation, for
 * each facility that enabled the automatic send (see lib/dhis2/sync.ts). Safe to call daily: a
 * month already sent is not sent again until it is reopened and validated anew.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized - Invalid or missing CRON_SECRET" }, { status: 401 });
  }

  try {
    const results = await runRma3AutoSendForAllTenants();
    return NextResponse.json({
      message: "DHIS2 RMA3 send completed",
      timestamp: new Date().toISOString(),
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      // Facility ids and periods only: the details are in each facility's DHIS2 history.
      results: results.map(({ tenantId, period, ok, error }) => ({ tenantId, period, ok, error })),
    });
  } catch (error) {
    console.error("Error in DHIS2 cron job:", error);
    return NextResponse.json({ error: "Failed to run DHIS2 send", timestamp: new Date().toISOString() }, { status: 500 });
  }
}

/** POST /api/cron/sync-dhis2 — same as GET, for cron services that only POST. */
export async function POST(request: NextRequest) {
  return GET(request);
}
