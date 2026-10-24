// Outbound call to AlphaCorp — the "online" half of the hybrid activation
// flow. No input body needed: client id/secret come from this install's own
// env, fingerprint is computed server-side. Mirrors the auth-header pattern
// already used for external calls in lib/dhis2/client.ts.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { computeFingerprint, fingerprintInstabilityReason } from "@/lib/onprem-license/fingerprint";
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

  // Trimmed: a value pasted into a hosting dashboard often carries a stray space or newline,
  // which would otherwise corrupt the Authorization header.
  const clientId = process.env.ONPREM_LICENSE_CLIENT_ID?.trim();
  const clientSecret = process.env.ONPREM_LICENSE_CLIENT_SECRET?.trim();
  const apiUrl = process.env.ALPHACORP_LICENSE_API_URL?.trim();
  if (!clientId || !clientSecret || !apiUrl) {
    return NextResponse.json(
      {
        error:
          "Online activation is not configured for this install (missing ONPREM_LICENSE_CLIENT_ID/SECRET or ALPHACORP_LICENSE_API_URL).",
      },
      { status: 500 }
    );
  }

  const instability = fingerprintInstabilityReason();
  if (instability) {
    return NextResponse.json({ error: instability }, { status: 500 });
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
    // What the administrator of this install can do about AlphaCorp's answer.
    const hint =
      response.status === 401
        ? " Check ONPREM_LICENSE_CLIENT_ID and ONPREM_LICENSE_CLIENT_SECRET in this deployment's environment: they must match the client in AlphaCorp's admin (its secret preview = the secret's last 6 characters; a rotated secret invalidates the old one). Redeploy after changing them."
        : response.status === 409
          ? " The AlphaCorp client was first activated from another install (different ONPREM_INSTALL_ID or machine): ask AlphaCorp to re-bind it, or use a dedicated client for this install."
          : "";
    return NextResponse.json(
      { error: `${body.error ?? "AlphaCorp rejected the activation request."}${hint}` },
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
