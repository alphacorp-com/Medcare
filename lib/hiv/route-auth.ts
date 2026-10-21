import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import type { ModuleAction } from "@/types/next-auth";

// Guard of every HIV / PMTCT / hepatitis / STI route: the MODULE_HIV permission (granted per
// user, see lib/sub-modules.ts), a facility account, and the session's tenant for every
// query. These records are among the most sensitive of the system: writes and the opening
// of a patient's program file are written to the audit log.

export interface HivAccess {
  tenantId: string;
  userId: string;
}

export async function requireHivAccess(action: ModuleAction): Promise<{ ok: true; access: HivAccess } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permCheck = requireModulePermission(session, "MODULE_HIV", action);
  if (!permCheck.ok) return { ok: false, response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { ok: false, response: NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 }) };
  return { ok: true, access: { tenantId, userId: session.user.id } };
}

export const hivBadRequest = (code: string) => NextResponse.json({ error: code, code, success: false }, { status: 400 });
export const hivNotFound = () => NextResponse.json({ error: "Not found", success: false }, { status: 404 });

export async function patientInTenant(tenantId: string, patientId: string) {
  return prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true, birthDate: true, gender: true } });
}

// A pregnancy of this tenant; of `patientId` when given (a partner test points to someone
// else's pregnancy).
export async function pregnancyInTenant(tenantId: string, pregnancyId: string, patientId?: string) {
  return prisma.pregnancy.findFirst({ where: { id: pregnancyId, tenantId, ...(patientId ? { patientId } : {}) }, select: { id: true, patientId: true } });
}

// Audit without any clinical detail (no result, no status): who touched which record.
export async function auditHiv(request: Request, access: HivAccess, action: string, resourceType: string, resourceId: string, patientId: string) {
  await recordAuditEvent({
    tenantId: access.tenantId,
    actorId: access.userId,
    actorType: "tenant_user",
    action,
    resourceType,
    resourceId,
    payload: { patientId },
    ...extractRequestMeta(request.headers),
  });
}
