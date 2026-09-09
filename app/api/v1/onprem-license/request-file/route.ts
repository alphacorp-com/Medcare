// Generates the offline "license request" file. Must run server-side — the
// per-client secret it HMAC-signs with must never reach the browser, so the
// file itself is built and signed here; the UI only triggers the download.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { computeFingerprint } from "@/lib/onprem-license/fingerprint";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.ONPREM_LICENSE_CLIENT_ID;
  const clientSecret = process.env.ONPREM_LICENSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Offline activation is not configured for this install (missing ONPREM_LICENSE_CLIENT_ID/SECRET)." },
      { status: 500 }
    );
  }

  const { raw: fingerprint } = computeFingerprint();
  const requestedAt = new Date().toISOString();
  const payload = { clientId, fingerprint, requestedAt };
  const payloadJson = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", clientSecret).update(payloadJson, "utf8").digest("hex");

  const requestFile = JSON.stringify({ ...payload, hmac }, null, 2);

  return new NextResponse(requestFile, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="license-request-${clientId}.json"`,
    },
  });
}
