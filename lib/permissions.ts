import type { Session } from "next-auth";
import type { ModuleAction } from "@/types/next-auth";

export function isAdminOrTenantAdmin(session: Session | null | undefined): boolean {
  const role = session?.user?.role;
  return role === "admin" || role === "tenant_admin";
}

export function hasModulePermission(
  session: Session | null | undefined,
  moduleId: string,
  action: ModuleAction
): boolean {
  if (!session?.user) return false;
  if (isAdminOrTenantAdmin(session)) return true;
  return (session.user.modules ?? []).some(
    (m) => m.moduleId === moduleId && m.actions.includes(action)
  );
}

export type PermissionCheck =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

export function requireModulePermission(
  session: Session | null | undefined,
  moduleId: string,
  action: ModuleAction
): PermissionCheck {
  if (!session?.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (!hasModulePermission(session, moduleId, action)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true };
}
