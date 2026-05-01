import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveTenantAccess, resolveTenantModules, syncTenantStatus } from "@/lib/tenant-licensing";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const access = await resolveTenantAccess(session.user.tenantId);
    const activeModules = access.isActive ? await resolveTenantModules(session.user.tenantId) : [];

    await syncTenantStatus(session.user.tenantId);

    return NextResponse.json({
      ...access,
      activeModules,
    });
  } catch (error) {
    console.error("Failed to resolve tenant licensing status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
