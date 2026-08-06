import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { getMobileMoneyConfig, resolveOrangeConfig, resolveMtnConfig } from "@/lib/payments/config";
import { testOrangeConnection } from "@/lib/payments/mobile-money/orange";
import { testMtnConnection } from "@/lib/payments/mobile-money/mtn";

// POST /api/v1/settings/payments/test — body: { provider: "orange" | "mtn" }
// Attempts to obtain an OAuth token from the already-saved credentials for that provider.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { provider } = (await req.json()) as { provider?: "orange" | "mtn" };
  if (provider !== "orange" && provider !== "mtn") {
    return NextResponse.json({ error: "provider must be 'orange' or 'mtn'" }, { status: 400 });
  }

  const stored = await getMobileMoneyConfig(session.user.tenantId);

  if (provider === "orange") {
    const config = resolveOrangeConfig(stored);
    if (!config) return NextResponse.json({ error: "Orange Money is not configured" }, { status: 400 });
    const result = await testOrangeConnection(config);
    return NextResponse.json(result);
  }

  const config = resolveMtnConfig(stored);
  if (!config) return NextResponse.json({ error: "MTN MoMo is not configured" }, { status: 400 });
  const result = await testMtnConnection(config);
  return NextResponse.json(result);
}
