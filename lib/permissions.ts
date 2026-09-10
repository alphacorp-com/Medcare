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

// Human-readable module names, used to build comprehensive permission-denied messages.
const MODULE_LABELS: Record<string, { en: string; fr: string }> = {
  MODULE_CORE_PATIENT: { en: "Patients", fr: "Patients" },
  MODULE_ADMISSION: { en: "Admissions", fr: "Admissions" },
  MODULE_PHARMACY: { en: "Pharmacy", fr: "Pharmacie" },
  MODULE_LAB: { en: "Laboratory", fr: "Laboratoire" },
  MODULE_SURGERY: { en: "Surgery", fr: "Chirurgie" },
  MODULE_RADIOLOGY: { en: "Radiology", fr: "Radiologie" },
  MODULE_BILLING: { en: "Billing", fr: "Facturation" },
  MODULE_PLANNING: { en: "Planning", fr: "Planning" },
  MODULE_MATERNITY: { en: "Maternity", fr: "Maternité" },
  MODULE_DISEASE_PROGRAMS: { en: "Disease Programs", fr: "Programmes de santé" },
};

const ACTION_PHRASES: Record<ModuleAction, { en: string; fr: string }> = {
  read: { en: "view records", fr: "consulter les données" },
  create: { en: "create records", fr: "créer des enregistrements" },
  update: { en: "edit records", fr: "modifier des enregistrements" },
  delete: { en: "delete records", fr: "supprimer des enregistrements" },
};

// Joins an English and French sentence into a single bilingual message. Kept as one string
// (rather than two separate response fields) so every existing call site that does
// `NextResponse.json({ error: check.error }, { status: check.status })` keeps working unchanged.
function bilingual(en: string, fr: string): string {
  return `${en} / ${fr}`;
}

const UNAUTHENTICATED = bilingual(
  "You must be signed in to perform this action.",
  "Vous devez être connecté(e) pour effectuer cette action."
);

const MUST_BE_ADMIN = bilingual(
  "This action requires administrator privileges. Contact your administrator for access.",
  "Cette action nécessite des privilèges d'administrateur. Contactez votre administrateur pour obtenir l'accès."
);

const MUST_BE_TENANT_ADMIN = bilingual(
  "This action requires tenant administrator privileges.",
  "Cette action nécessite des privilèges d'administrateur de l'établissement."
);

const SELF_OR_ADMIN_REQUIRED = bilingual(
  "You can only manage your own account, unless you have administrator privileges.",
  "Vous ne pouvez gérer que votre propre compte, sauf si vous disposez de privilèges d'administrateur."
);

// For ownership checks on personal resources (a conversation you're not part of, a
// notification that isn't yours) — not a role/module grant, just "this isn't yours".
export const RESOURCE_ACCESS_DENIED = bilingual(
  "You don't have permission to access this resource.",
  "Vous n'avez pas la permission d'accéder à cette ressource."
);

export type PermissionCheck =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

export function requireModulePermission(
  session: Session | null | undefined,
  moduleId: string,
  action: ModuleAction
): PermissionCheck {
  if (!session?.user) {
    return { ok: false, status: 401, error: UNAUTHENTICATED };
  }
  if (!hasModulePermission(session, moduleId, action)) {
    const moduleLabel = MODULE_LABELS[moduleId] ?? { en: moduleId, fr: moduleId };
    const actionPhrase = ACTION_PHRASES[action];
    return {
      ok: false,
      status: 403,
      error: bilingual(
        `You don't have permission to ${actionPhrase.en} in the ${moduleLabel.en} module. Contact your administrator to request access.`,
        `Vous n'avez pas la permission de ${actionPhrase.fr} dans le module ${moduleLabel.fr}. Contactez votre administrateur pour demander l'accès.`
      ),
    };
  }
  return { ok: true };
}

// For routes gated to "admin" (platform) or "tenant_admin" — e.g. managing other users.
export function requireAdminOrTenantAdmin(session: Session | null | undefined): PermissionCheck {
  if (!session?.user) {
    return { ok: false, status: 401, error: UNAUTHENTICATED };
  }
  if (!isAdminOrTenantAdmin(session)) {
    return { ok: false, status: 403, error: MUST_BE_ADMIN };
  }
  return { ok: true };
}

// For routes gated strictly to "tenant_admin" (e.g. managing departments, schedules, DHIS2
// settings) — stricter than requireAdminOrTenantAdmin, platform admins don't bypass this one.
export function requireTenantAdmin(session: Session | null | undefined): PermissionCheck {
  if (!session?.user) {
    return { ok: false, status: 401, error: UNAUTHENTICATED };
  }
  if (session.user.role !== "tenant_admin") {
    return { ok: false, status: 403, error: MUST_BE_TENANT_ADMIN };
  }
  return { ok: true };
}

// For routes where either the caller acting on their own account, or an admin/tenant_admin
// acting on someone else's, is allowed (viewing/editing/deleting another user's record).
export function requireSelfOrAdmin(
  session: Session | null | undefined,
  targetUserId: string
): PermissionCheck {
  if (!session?.user) {
    return { ok: false, status: 401, error: UNAUTHENTICATED };
  }
  if (session.user.id !== targetUserId && !isAdminOrTenantAdmin(session)) {
    return { ok: false, status: 403, error: SELF_OR_ADMIN_REQUIRED };
  }
  return { ok: true };
}
