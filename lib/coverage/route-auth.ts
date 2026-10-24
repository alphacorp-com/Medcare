import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission, requireTenantAdmin } from "@/lib/permissions";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { CoverageError } from "@/lib/coverage/claims";
import type { ModuleAction } from "@/types/next-auth";

// Guards of the third-party payment routes. Everything is scoped to the session's facility,
// never to an id sent by the browser.
//  - billingGuard: patient coverages, authorizations, invoices, claims and settlements
//    (MODULE_BILLING; granting a free care needs "validate").
//  - settingsGuard: payers, conventions and free-care programmes are facility settings, edited
//    by the tenant administrator; billing staff can read them.

type Guard = { ok: true; session: Session; tenantId: string; userId: string } | { ok: false; response: NextResponse };

const deny = (error: string, status: number): Guard => ({ ok: false, response: NextResponse.json({ error, code: error }, { status }) });

export async function billingGuard(action: ModuleAction): Promise<Guard> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return deny("Unauthorized", 401);
  const check = requireModulePermission(session, "MODULE_BILLING", action);
  if (!check.ok) return deny(check.error, check.status);
  if (!session.user.tenantId) return deny("A facility account is required", 403);
  return { ok: true, session, tenantId: session.user.tenantId, userId: session.user.id };
}

export async function settingsGuard(mode: "read" | "write"): Promise<Guard> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return deny("Unauthorized", 401);
  const admin = requireTenantAdmin(session);
  if (!admin.ok && (mode === "write" || !requireModulePermission(session, "MODULE_BILLING", "read").ok)) return deny(admin.error, admin.status);
  if (!session.user.tenantId) return deny("A facility account is required", 403);
  return { ok: true, session, tenantId: session.user.tenantId, userId: session.user.id };
}

export const coverageError = (code: string, status = 400) => NextResponse.json({ error: code, code }, { status });

// Known errors as 4xx with their code; anything else is logged and answered without detail.
export function handleCoverageError(error: unknown, where: string) {
  if (error instanceof CoverageError) return coverageError(error.code, error.status);
  if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") return coverageError("duplicate", 409);
  console.error(`[${where}]`, error);
  return coverageError("internal_error", 500);
}

export async function auditCoverage(request: Request, guard: { tenantId: string; userId: string }, action: string, resourceType: string, resourceId: string, payload: Record<string, unknown>) {
  const { ipAddress, userAgent } = extractRequestMeta(request.headers);
  await recordAuditEvent({ tenantId: guard.tenantId, actorId: guard.userId, actorType: "tenant_user", action, resourceType, resourceId, payload, ipAddress, userAgent });
}
