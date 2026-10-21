import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { computeStockReport } from "@/lib/stock/report-data";

// ── GET /api/v1/pharmacy/stock-report?period=YYYYMM ─────────────────────────
// Monthly stock report of every active article (see lib/stock/report.ts for the rules).
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
    }

    const period = new URL(request.url).searchParams.get("period") ?? "";
    const report = await computeStockReport(tenantId, period);
    if (!report) {
      return NextResponse.json({ error: "invalid_period", code: "invalid_period", success: false }, { status: 400 });
    }
    return NextResponse.json({ data: report, success: true });
  } catch (error) {
    console.error("[GET /api/v1/pharmacy/stock-report]", error);
    return NextResponse.json({ error: "Failed to compute the stock report", success: false }, { status: 500 });
  }
}
