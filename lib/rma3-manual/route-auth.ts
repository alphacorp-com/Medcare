import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { requireModulePermission, requireTenantAdmin } from "@/lib/permissions";
import { Rma3ManualError } from "@/lib/rma3-manual/data";
import type { ModuleAction } from "@/types/next-auth";

// Shared guard of the RMA3 monthly form routes: signed in, MODULE_RMA3 for `action` (tenant
// admins pass), attached to a facility (the tenant always comes from the session).

export interface Rma3Access {
  session: Session;
  tenantId: string;
  userId: string;
}

type Guarded = { ok: true; access: Rma3Access } | { ok: false; response: NextResponse };

async function guard(check: (session: Session) => { ok: true } | { ok: false; status: number; error: string }): Promise<Guarded> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permCheck = check(session);
  if (!permCheck.ok) return { ok: false, response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { ok: false, response: NextResponse.json({ error: "A facility account is required" }, { status: 403 }) };
  return { ok: true, access: { session, tenantId, userId: session.user.id } };
}

export const requireRma3Access = (action: ModuleAction) => guard((session) => requireModulePermission(session, "MODULE_RMA3", action));

// Reopening a validated month is an administrator decision.
export const requireRma3Admin = () => guard((session) => requireTenantAdmin(session));

export const badRequest = (code: string) => NextResponse.json({ error: code, code }, { status: 400 });

// Known business errors become their status and code; anything else is logged and hidden.
export function errorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof Rma3ManualError) return NextResponse.json({ error: error.code, code: error.code }, { status: error.status });
  console.error(`[rma3-entry] ${context}`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function auditRma3(request: Request, access: Rma3Access, action: string, resourceId: string, payload: Record<string, unknown>) {
  await recordAuditEvent({
    tenantId: access.tenantId,
    actorId: access.userId,
    actorType: "tenant_user",
    action,
    resourceType: "rma3_manual_form",
    resourceId,
    payload,
    ...extractRequestMeta(request.headers),
  });
}
