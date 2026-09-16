import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkOnPremLicenseGuard } from "@/lib/onprem-license/guard";
import prisma from "@/lib/prisma";
import { resolveTenantModules, syncTenantModulesFromLicense } from "@/lib/tenant-licensing";
import { MODULE_CATALOG } from "@/lib/module-catalog";

const CATALOG_CODES = new Set(MODULE_CATALOG.map((m) => m.code));

// Single source of truth for "is this install licensed" across the app —
// backed by the on-prem license (OnPremLicense/checkOnPremLicenseGuard),
// the only license system AlphaCorp issues for on-prem deployments. Consumed
// by AuthInitializer (whole-app session hydration) and the dashboard's
// SubscriptionStatus widget.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const guard = await checkOnPremLicenseGuard();
    const isActive = !guard.blocked;
    let activeModules = isActive ? await resolveTenantModules(session.user.tenantId) : [];

    // Self-heal: if the applied license grants modules that aren't enabled
    // for this tenant (e.g. the license was applied before the module catalog
    // existed), re-sync from the license instead of showing everything as
    // disabled until the license is imported again.
    if (isActive) {
      const license = await prisma.onPremLicense.findUnique({ where: { id: "current" }, select: { modules: true } });
      const enabled = new Set(activeModules.map((m) => m.moduleId));
      if (license && license.modules.some((code) => CATALOG_CODES.has(code) && !enabled.has(code))) {
        await syncTenantModulesFromLicense(session.user.tenantId, license.modules);
        activeModules = await resolveTenantModules(session.user.tenantId);
      }
    }

    const reason =
      guard.reason === "no_license"
        ? "No license has been activated on this install yet."
        : guard.reason === "expired"
          ? "This install's license has expired past its grace period."
          : "Tenant is active via a valid on-prem license.";

    return NextResponse.json({
      isActive,
      source: isActive ? "onprem_license" : "none",
      reason,
      validUntil: guard.validUntil ? guard.validUntil.toISOString() : null,
      activeModules,
    });
  } catch (error) {
    console.error("Failed to resolve tenant licensing status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
