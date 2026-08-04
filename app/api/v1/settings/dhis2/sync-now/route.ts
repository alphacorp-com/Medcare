import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { previousMonthPeriod } from "@/lib/dhis2/indicators";
import { runDhis2Sync } from "@/lib/dhis2/sync";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized - Tenant admin access required" }, { status: 403 });
  }

  const data = await req.json().catch(() => ({}));
  const period = (data as { period?: string })?.period || previousMonthPeriod();

  const summary = await runDhis2Sync(session.user.tenantId, period, session.user.id);
  return NextResponse.json(summary, { status: summary.status === "failed" ? 502 : 200 });
}
