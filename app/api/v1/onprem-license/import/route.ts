// Imports the offline "license response" file (its raw text content, an
// ALC1.<payload>.<signature> token) that AlphaCorp's admin generated after
// processing this install's request file.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { applyLicenseToken, LicenseApplyError } from "@/lib/onprem-license/apply";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`onprem-license-import:${session.user.id}`, 5, 10 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "The license file's contents are required." }, { status: 400 });
  }

  try {
    const result = await applyLicenseToken(token, "offline", session.user.id);
    return NextResponse.json({ message: "License applied.", validUntil: result.validUntil });
  } catch (error) {
    const message = error instanceof LicenseApplyError ? error.message : "Failed to apply the license file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
