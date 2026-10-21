import type { Session } from "next-auth";
import { canViewWidget, findDashboardWidget, type DashboardViewer } from "@/lib/dashboard/widgets";
import { WIDGET_LOADERS } from "@/lib/dashboard/loaders";
import type { WidgetBatchResponse } from "@/lib/dashboard/widget-data";

// Loads several generic widgets for one viewer. Shared by GET /api/v1/dashboard/widgets
// (client refreshes) and the dashboard page (server prefetch of the first render), so both
// apply the same per-widget authorization. One widget failing or being forbidden doesn't
// fail the others.
export async function loadWidgetBatch(
  session: Session,
  viewer: DashboardViewer,
  ids: readonly string[]
): Promise<WidgetBatchResponse> {
  const tenantId = session.user.tenantId;
  const ctx = { tenantId: tenantId ?? "", userId: session.user.id };

  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, WidgetBatchResponse["results"][string]]> => {
      const widget = findDashboardWidget(id);
      const loader = WIDGET_LOADERS[id];
      // Custom widgets have their own routes, so they have no loader here.
      if (!tenantId || !widget || !loader) return [id, { ok: false, status: 404 }];
      if (!canViewWidget(widget, session, viewer)) return [id, { ok: false, status: 403 }];
      try {
        return [id, { ok: true, data: await loader(ctx) }];
      } catch (error) {
        console.error(`[dashboard widget batch] ${id}`, error);
        return [id, { ok: false, status: 500 }];
      }
    })
  );
  return { results: Object.fromEntries(entries) };
}
