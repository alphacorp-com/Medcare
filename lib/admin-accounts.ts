import prisma from "@/lib/prisma";
import { bilingual } from "@/lib/permissions";

export type LockoutCheck = { ok: true } | { ok: false; status: 409; error: string };

const LAST_SUPER_ADMIN_ERROR = bilingual(
  "You cannot remove, deactivate, or demote the last remaining active super admin account.",
  "Vous ne pouvez pas supprimer, désactiver ou rétrograder le dernier compte super administrateur actif restant."
);

// Prevents locking the platform out of super-admin access. Call before deleting a superadmin,
// deactivating one, or changing their role away from "superadmin".
export async function assertNotLastActiveSuperAdmin(excludeId: string): Promise<LockoutCheck> {
  const remaining = await prisma.adminUser.count({
    where: { role: "superadmin", isActive: true, id: { not: excludeId } },
  });

  if (remaining === 0) {
    return { ok: false, status: 409, error: LAST_SUPER_ADMIN_ERROR };
  }

  return { ok: true };
}
