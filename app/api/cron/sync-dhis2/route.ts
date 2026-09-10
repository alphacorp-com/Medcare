import { NextRequest, NextResponse } from "next/server";
import { runDhis2SyncForAllTenants } from "@/lib/dhis2/sync";

/**
 * GET /api/cron/sync-dhis2
 *
 * Pushes the previous month's aggregate indicators to DHIS2 for every tenant
 * that has DHIS2 sync enabled. Meant to be called once a month by an external
 * cron service (Vercel Cron, EasyCron, AWS EventBridge, etc.) — same pattern
 * as /api/cron/check-subscriptions.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid or missing CRON_SECRET" },
        { status: 401 }
      );
    }

    console.log("Starting DHIS2 monthly sync...");

    const summaries = await runDhis2SyncForAllTenants();

    return NextResponse.json(
      {
        message: "DHIS2 sync completed",
        timestamp: new Date().toISOString(),
        results: summaries,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DHIS2 cron job:", error);
    return NextResponse.json(
      {
        error: "Failed to run DHIS2 sync",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/sync-dhis2
 * Alternative POST method for cron job flexibility.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
