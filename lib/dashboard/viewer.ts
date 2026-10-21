import type { Session } from "next-auth";
import prisma from "@/lib/prisma";
import { resolveTenantModules } from "@/lib/tenant-licensing";
import type { DashboardViewer } from "@/lib/dashboard/widgets";

// Resolves the viewer facts canViewWidget() needs beyond the session. Read from the
// database on every call rather than added to the JWT, so a license change or a role's
// isClinicalProvider toggle applies on the next dashboard load without re-login.
export async function resolveDashboardViewer(session: Session): Promise<DashboardViewer> {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { licensedModules: new Set(), isClinicalProvider: false };
  }

  const [tenantModules, tenantUser] = await Promise.all([
    resolveTenantModules(tenantId),
    prisma.tenantUser.findFirst({
      where: { id: session.user.id, tenantId },
      select: { role: { select: { isClinicalProvider: true } } },
    }),
  ]);

  return {
    licensedModules: new Set(tenantModules.map((m) => m.moduleId)),
    isClinicalProvider: tenantUser?.role.isClinicalProvider ?? false,
  };
}
