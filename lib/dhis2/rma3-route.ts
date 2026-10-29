import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertPeriod, rma3ErrorResponse } from "./rma3-sync";

// Shared guard of the RMA3 → DHIS2 routes: an administrator of the session's facility (the data
// is the whole month's health activity and the DHIS2 credentials are the facility's), and a limit
// on how often the report may be recomputed — each call reads a month of registers.
export async function rma3Guard(scope: "read" | "heavy") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permission = requireTenantAdmin(session);
  if (!permission.ok) return { ok: false as const, response: NextResponse.json({ error: permission.error }, { status: permission.status }) };
  const limit = scope === "heavy" ? { max: 6, windowMs: 10 * 60_000 } : { max: 40, windowMs: 10 * 60_000 };
  if (!checkRateLimit(`dhis2-rma3-${scope}:${session.user.id}`, limit.max, limit.windowMs).allowed) {
    return { ok: false as const, response: NextResponse.json({ error: "too_many_requests" }, { status: 429 }) };
  }
  return { ok: true as const, tenantId: session.user.tenantId, userId: session.user.id };
}

export function periodFrom(value: string | null | undefined): { period: string } | { response: NextResponse } {
  try {
    return { period: assertPeriod(value) };
  } catch (error) {
    const { code, status } = rma3ErrorResponse(error);
    return { response: NextResponse.json({ error: code }, { status }) };
  }
}

export function failure(error: unknown, where: string) {
  const { code, status } = rma3ErrorResponse(error);
  if (status >= 500) console.error(`[${where}]`, error);
  return NextResponse.json({ error: code }, { status });
}
