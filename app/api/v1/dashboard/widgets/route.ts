import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveDashboardViewer } from "@/lib/dashboard/viewer";
import { loadWidgetBatch } from "@/lib/dashboard/batch";

const MAX_WIDGETS_PER_BATCH = 30;
const WIDGET_ID_RE = /^[a-z0-9-]{1,60}$/;

// ── GET /api/v1/dashboard/widgets?ids=a,b,c ────────────────────────────────
// Serves several generic dashboard widgets in one request: the session and the viewer
// (license + clinical-provider flag) are resolved once instead of once per widget, and the
// loaders run in parallel. Each widget is still authorized individually with the same rule
// the page uses (canViewWidget); one widget failing or being forbidden doesn't fail the rest.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawIds = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(rawIds.split(",").map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_WIDGETS_PER_BATCH || !ids.every((id) => WIDGET_ID_RE.test(id))) {
    return NextResponse.json({ error: "Invalid widget list" }, { status: 400 });
  }

  try {
    const viewer = await resolveDashboardViewer(session);
    return NextResponse.json(await loadWidgetBatch(session, viewer, ids));
  } catch (error) {
    console.error("[GET /api/v1/dashboard/widgets]", error);
    return NextResponse.json({ error: "Failed to load dashboard widgets" }, { status: 500 });
  }
}
