import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { RESOURCE_ACCESS_DENIED } from "@/lib/permissions";
import { canViewWidget, findDashboardWidget } from "@/lib/dashboard/widgets";
import { resolveDashboardViewer } from "@/lib/dashboard/viewer";
import { WIDGET_LOADERS } from "@/lib/dashboard/loaders";

// ── GET /api/v1/dashboard/widgets/[id] ──────────────────────────────────────
// Serves one generic dashboard widget. Authorization uses the exact same rule as the
// page that decides whether to render it (canViewWidget), so a widget hidden from a
// user can't be fetched directly either.
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const widget = findDashboardWidget(id);
  const loader = WIDGET_LOADERS[id];
  // Custom widgets have their own routes, so they have no loader here.
  if (!widget || !loader) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  try {
    const viewer = await resolveDashboardViewer(session);
    if (!canViewWidget(widget, session, viewer)) {
      return NextResponse.json({ error: RESOURCE_ACCESS_DENIED }, { status: 403 });
    }

    const data = await loader({ tenantId: session.user.tenantId, userId: session.user.id });
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[GET /api/v1/dashboard/widgets/${id}]`, error);
    return NextResponse.json({ error: "Failed to load dashboard widget" }, { status: 500 });
  }
}
