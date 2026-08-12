import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Fixed placeholder actor for audit rows with no authenticated actor (e.g. failed logins).
// AuditLog.actorId is non-nullable, so unauthenticated events need a stand-in id.
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

export type AuditActorType = "admin" | "tenant_user" | "system" | "api";

export interface AuditEventInput {
  tenantId?: string | null;
  actorId: string;
  actorType: AuditActorType;
  action: string;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Writes an AuditLog row. Never throws — a failed audit write must never break the
// real mutation/login it's describing.
export async function recordAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: event.tenantId ?? null,
        actorId: event.actorId,
        actorType: event.actorType,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        payload: event.payload as unknown as Prisma.InputJsonValue | undefined,
        ipAddress: event.ipAddress ?? undefined,
        userAgent: event.userAgent ?? undefined,
      },
    });
  } catch (error) {
    console.error("[recordAuditEvent] failed to write audit log", error);
  }
}

// Extracts client IP/User-Agent from a Fetch API Headers instance (route handlers).
export function extractRequestMeta(headers: Headers): { ipAddress: string | null; userAgent: string | null } {
  const forwardedFor = headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : headers.get("x-real-ip");
  return { ipAddress, userAgent: headers.get("user-agent") };
}

// Extracts client IP/User-Agent from NextAuth's plain header-record shape, passed as the
// second argument to a CredentialsProvider's authorize(credentials, req) callback.
export function extractAuthRequestMeta(
  headers: Record<string, string | string[] | undefined> | undefined
): { ipAddress: string | null; userAgent: string | null } {
  if (!headers) return { ipAddress: null, userAgent: null };
  const get = (key: string): string | null => {
    const value = headers[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };
  const forwardedFor = get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : get("x-real-ip");
  return { ipAddress, userAgent: get("user-agent") };
}
