import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import type { ModuleAction } from "@/types/next-auth";

// Shared guard of the EPI routes (sessions, AEFI, cold chain): signed in, allowed on the
// disease programs module for `action`, and attached to a facility (everything is scoped
// to the session's tenant, never to an id sent by the browser).
export async function requireEpiAccess(
  action: ModuleAction
): Promise<{ ok: true; session: Session; tenantId: string; userId: string } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permCheck = requireModulePermission(session, "MODULE_DISEASE_PROGRAMS", action);
  if (!permCheck.ok) return { ok: false, response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { ok: false, response: NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 }) };
  return { ok: true, session, tenantId, userId: session.user.id };
}

// ?month=YYYY-MM → [start, end) in UTC; the current month when absent.
export function monthRange(month: string | null, now = new Date()): { start: Date; end: Date } | null {
  const value = month ?? now.toISOString().slice(0, 7);
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return { start: new Date(Date.UTC(year, index, 1)), end: new Date(Date.UTC(year, index + 1, 1)) };
}

export const badRequest = (code: string) => NextResponse.json({ error: code, code, success: false }, { status: 400 });
