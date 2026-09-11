import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkOnPremLicenseGuard } from "@/lib/onprem-license/guard";
import { resolveTenantModules } from "@/lib/tenant-licensing";

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
    const activeModules = isActive ? await resolveTenantModules(session.user.tenantId) : [];

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
