import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { requireModulePermission } from "@/lib/permissions";
import type { ModuleAction } from "@/types/next-auth";

// Guard of the blood bank routes: the laboratory module (MODULE_LAB) for `action`, and the
// facility of the session. Donor screening results (HIV, hepatitis, syphilis) are sensitive:
// every write is audited.

export type BloodAccess = { tenantId: string; userId: string };

export async function requireBloodBankAccess(action: ModuleAction): Promise<{ ok: true; access: BloodAccess } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permCheck = requireModulePermission(session, "MODULE_LAB", action);
  if (!permCheck.ok) return { ok: false, response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { ok: false, response: NextResponse.json({ error: "A facility account is required" }, { status: 403 }) };
  return { ok: true, access: { tenantId, userId: session.user.id } };
}

export const bloodError = (code: string, status = 400) => NextResponse.json({ error: code, code }, { status });

export async function auditBlood(request: Request, access: BloodAccess, action: string, resourceType: string, resourceId: string, payload: Record<string, unknown> = {}) {
  await recordAuditEvent({
    tenantId: access.tenantId,
    actorId: access.userId,
    actorType: "tenant_user",
    action,
    resourceType,
    resourceId,
    payload,
    ...extractRequestMeta(request.headers),
  });
}
