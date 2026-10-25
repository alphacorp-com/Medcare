import { ModuleStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { SYSTEM_ACTOR_ID } from "@/lib/audit";
import { ensureModuleCatalog } from "@/lib/module-catalog";

// What the applied AlphaCorp on-prem license grants this install: modules and caps. The
// license (OnPremLicense, lib/onprem-license) is the only source — the former SaaS
// subscriptions / license keys were removed (migration 20261103090000_drop_legacy_saas).

export type ModulePermission = {
  moduleId: string;
  actions: string[];
};

// Resolves how many active user seats a tenant is currently entitled to, based on its
// current AlphaCorp on-prem license's `maxUsers` entitlement — the single per-install
// seat cap in the on-prem deployment model (an install has exactly one tenant, one
// license, no per-tenant Subscription). Returns null when no license is applied yet,
// or the license doesn't cap seats — in that case seat count is not enforced.
export async function getTenantSeatLimit(_tenantId: string): Promise<number | null> {
  const license = await prisma.onPremLicense.findUnique({ where: { id: "current" } });
  return license?.maxUsers ?? null;
}

// Same as getTenantSeatLimit, for the license's `maxBeds` entitlement.
export async function getTenantBedLimit(_tenantId: string): Promise<number | null> {
  const license = await prisma.onPremLicense.findUnique({ where: { id: "current" } });
  return license?.maxBeds ?? null;
}

export async function isModuleActiveForTenant(tenantId: string, moduleCode: string): Promise<boolean> {
  const activeStatuses = [ModuleStatus.active, ModuleStatus.trial];

  const assignment = await prisma.tenantModule.findFirst({
    where: {
      tenantId,
      status: { in: activeStatuses },
      module: { code: moduleCode },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

export async function resolveTenantModules(tenantId: string): Promise<ModulePermission[]> {
  const activeStatuses = [ModuleStatus.active, ModuleStatus.trial];

  const tenantModuleAssignments = await prisma.tenantModule.findMany({
    where: {
      tenantId,
      status: { in: activeStatuses },
    },
    include: {
      module: true,
    },
  });

  return tenantModuleAssignments
    .filter((assignment) => Boolean(assignment.module?.code))
    .map((assignment) => ({
      moduleId: assignment.module.code,
      actions: ["read", "create", "update", "delete", "validate"],
    }));
}

// Called from applyLicenseToken() every time an AlphaCorp on-prem license is
// activated or imported — makes the license's module list the actual source
// of truth for TenantModule, which is what isModuleActiveForTenant()/
// resolveTenantModules() consult. Without this, plannedModules chosen in
// AlphaCorp's admin console had no effect on what MedCare actually enforces.
export async function syncTenantModulesFromLicense(tenantId: string, licensedModuleCodes: string[]): Promise<void> {
  // A fresh install may never have run the seed script — without the catalog
  // there is nothing to map the license's module codes onto.
  await ensureModuleCatalog();
  const modules = await prisma.module.findMany({ select: { id: true, code: true } });
  const licensedSet = new Set(licensedModuleCodes);
  const now = new Date();

  await prisma.$transaction(
    modules.map((module) => {
      const isLicensed = licensedSet.has(module.code);
      return prisma.tenantModule.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId: module.id } },
        create: {
          tenantId,
          moduleId: module.id,
          status: isLicensed ? ModuleStatus.active : ModuleStatus.suspended,
          activatedAt: isLicensed ? now : null,
          activatedBy: SYSTEM_ACTOR_ID,
        },
        update: {
          status: isLicensed ? ModuleStatus.active : ModuleStatus.suspended,
          ...(isLicensed ? { activatedAt: now } : {}),
        },
      });
    })
  );
}
