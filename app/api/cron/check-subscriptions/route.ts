import { NextRequest, NextResponse } from "next/server";
import { checkAndUpdateExpiredSubscriptions } from "@/lib/subscription-sync";

/**
 * GET /api/cron/check-subscriptions
 * 
 * This endpoint checks for subscriptions that have passed their period end date
 * and updates their status to past_due.
 * 
 * This should be called periodically by a cron job service (e.g., Vercel Cron, 
 * EasyCron, AWS EventBridge, etc.)
 * 
 * To secure this endpoint, you can:
 * 1. Use an Authorization header with a secret token
 * 2. Restrict access by IP address
 * 3. Use a cron service that provides its own verification
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid or missing CRON_SECRET" },
        { status: 401 }
      );
    }

    console.log("Starting subscription expiration check...");

    // Check and update expired subscriptions
    await checkAndUpdateExpiredSubscriptions();

    return NextResponse.json(
      {
        message: "Subscription expiration check completed successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in cron job:", error);
    return NextResponse.json(
      {
        error: "Failed to check subscriptions",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/check-subscriptions
 * Alternative POST method for cron job flexibility
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
