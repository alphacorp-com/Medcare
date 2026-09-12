// Outbound call to AlphaCorp — the "online" half of the hybrid activation
// flow. No input body needed: client id/secret come from this install's own
// env, fingerprint is computed server-side. Mirrors the auth-header pattern
// already used for external calls in lib/dhis2/client.ts.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { computeFingerprint } from "@/lib/onprem-license/fingerprint";
import { applyLicenseToken, LicenseApplyError } from "@/lib/onprem-license/apply";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.isSystemAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`onprem-license-activate:${session.user.id}`, 5, 10 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const clientId = process.env.ONPREM_LICENSE_CLIENT_ID;
  const clientSecret = process.env.ONPREM_LICENSE_CLIENT_SECRET;
  const apiUrl = process.env.ALPHACORP_LICENSE_API_URL;
  if (!clientId || !clientSecret || !apiUrl) {
    return NextResponse.json(
      {
        error:
          "Online activation is not configured for this install (missing ONPREM_LICENSE_CLIENT_ID/SECRET or ALPHACORP_LICENSE_API_URL).",
      },
      { status: 500 }
    );
  }

  const { raw: fingerprint } = computeFingerprint();

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientId}.${clientSecret}`,
      },
      body: JSON.stringify({ fingerprint }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not reach AlphaCorp. Check this site's internet connection, or use the offline activation flow instead.",
      },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    return NextResponse.json(
      { error: body.error ?? "AlphaCorp rejected the activation request." },
      { status: response.status }
    );
  }

  const responseBody = await response.json().catch(() => ({}) as { token?: unknown });
  if (typeof responseBody.token !== "string") {
    return NextResponse.json({ error: "AlphaCorp returned an unexpected response." }, { status: 502 });
  }

  try {
    const result = await applyLicenseToken(responseBody.token, "online", session.user.id);
    return NextResponse.json({ message: "License activated.", validUntil: result.validUntil });
  } catch (error) {
    const message = error instanceof LicenseApplyError ? error.message : "Failed to apply the received license.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
