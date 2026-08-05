import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { previousMonthPeriod } from "@/lib/dhis2/indicators";
import { runDhis2Sync } from "@/lib/dhis2/sync";
import { requireTenantAdmin } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const data = await req.json().catch(() => ({}));
  const period = (data as { period?: string })?.period || previousMonthPeriod();

  const summary = await runDhis2Sync(session.user.tenantId, period, session.user.id);
  return NextResponse.json(summary, { status: summary.status === "failed" ? 502 : 200 });
}
