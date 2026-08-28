import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redeemLicenseForTenant } from "@/lib/tenant-licensing";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractRequestMeta } from "@/lib/audit";

// At most 5 activation attempts per user per 15 minutes — a legitimate user retyping
// a key a couple of times is unaffected; a script trying candidate keys is not.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

// A license key is capped well under this — anything longer is not a genuine
// attempt and not worth hashing/looking up.
const MAX_KEY_LENGTH = 64;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`license-activate:${session.user.id}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const licenseKey = String(body.licenseKey || "").trim();

    if (!licenseKey || licenseKey.length > MAX_KEY_LENGTH) {
      return NextResponse.json({ error: "License key is required." }, { status: 400 });
    }

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);

    const result = await redeemLicenseForTenant({
      tenantId: session.user.tenantId,
      rawLicenseKey: licenseKey,
      redeemedByUserId: session.user.id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      message: "Tenant successfully activated.",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate license.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
