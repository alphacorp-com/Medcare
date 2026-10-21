import { getServerSession } from "next-auth/next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { authOptions } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { visibleDashboardWidgets, widgetRefreshBatches, type DashboardWidget } from "@/lib/dashboard/widgets";
import { resolveDashboardViewer } from "@/lib/dashboard/viewer";
import { loadWidgetBatch } from "@/lib/dashboard/batch";
import { AmountTile, StatTile } from "@/components/dashboard/StatTile";
import { ListPanel } from "@/components/dashboard/ListPanel";
import { PatientQueue } from "@/components/dashboard/PatientQueue";
import { AuditActivity } from "@/components/dashboard/AuditActivity";
import { StockAlerts } from "@/components/dashboard/StockAlerts";
import { SubscriptionStatus } from "@/components/dashboard/SubscriptionStatus";

// Custom widgets keep their bespoke component and API route; each of those routes
// enforces the same permission the registry declares for it.
const CUSTOM_WIDGETS: Record<string, React.ComponentType> = {
  "patient-queue": PatientQueue,
  "stock-alerts": StockAlerts,
  "subscription-status": SubscriptionStatus,
  "audit-activity": AuditActivity,
};

type Batches = Map<string, string[]>;

function renderTile(widget: DashboardWidget, batches: Batches) {
  const batchIds = batches.get(widget.id) ?? [widget.id];
  return widget.kind === "amount" ? (
    <AmountTile key={widget.id} widgetId={widget.id} refreshMs={widget.refreshMs} batchIds={batchIds} />
  ) : (
    <StatTile key={widget.id} widgetId={widget.id} refreshMs={widget.refreshMs} batchIds={batchIds} />
  );
}

function renderPanel(widget: DashboardWidget, batches: Batches) {
  const Custom = CUSTOM_WIDGETS[widget.id];
  if (widget.kind === "custom" && !Custom) return null;
  return (
    <div key={widget.id} className={cn("h-[380px] min-h-0", widget.size === "wide" && "md:col-span-2")}>
      {Custom ? <Custom /> : <ListPanel widgetId={widget.id} refreshMs={widget.refreshMs} batchIds={batches.get(widget.id) ?? [widget.id]} />}
    </div>
  );
}

// The home dashboard is composed per user: only widgets the viewer may see are
// rendered (lib/dashboard/widgets.ts). This is a convenience, not the security
// boundary — every widget's API route re-checks the same permission.
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("dashboard");
  const viewer = await resolveDashboardViewer(session);
  const widgets = visibleDashboardWidgets(session, viewer);
  const tiles = widgets.filter((w) => w.kind === "stat" || w.kind === "amount");
  const panels = widgets.filter((w) => w.kind === "list" || w.kind === "custom");
  // One request per refresh interval instead of one per widget.
  const batches = widgetRefreshBatches(widgets);

  // First render arrives with its data: each batch is loaded here, with the same function
  // and authorization as GET /api/v1/dashboard/widgets, and handed to the client cache
  // under the exact key the widgets query. They then only refresh on their interval.
  // The JSON round-trip makes the cached value identical to what the API would return.
  const queryClient = new QueryClient();
  await Promise.all(
    [...new Set(batches.values())].map(async (ids) => {
      const batch = await loadWidgetBatch(session, viewer, ids);
      queryClient.setQueryData(["dashboard-widgets", ids], JSON.parse(JSON.stringify(batch)));
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-4">
        {tiles.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{tiles.map((w) => renderTile(w, batches))}</div>
        )}

        {panels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{panels.map((w) => renderPanel(w, batches))}</div>
        )}

        {widgets.length === 0 && (
          <div className="bg-white rounded border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-500">
            {t("no_widgets")}
          </div>
        )}
      </div>
    </HydrationBoundary>
  );
}
