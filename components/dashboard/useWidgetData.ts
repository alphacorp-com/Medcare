"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { WidgetBatchResponse, WidgetData } from "@/lib/dashboard/widget-data";

type WidgetState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

// Every widget of one refresh group passes the same `batchIds` (computed by the dashboard
// page), so they share one query key: TanStack deduplicates them into a single
// GET /api/v1/dashboard/widgets?ids=… per group and refresh. Polling pauses while the tab
// is hidden, and a failed refresh keeps showing the last good data.
export function useWidgetData<T extends WidgetData>(
  widgetId: string,
  refreshMs: number,
  batchIds: readonly string[]
): WidgetState<T> {
  const query = useQuery({
    queryKey: ["dashboard-widgets", batchIds],
    queryFn: () => apiFetch<WidgetBatchResponse>(`/api/v1/dashboard/widgets?ids=${encodeURIComponent(batchIds.join(","))}`),
    refetchInterval: refreshMs > 0 ? refreshMs : false,
    staleTime: refreshMs > 0 ? refreshMs : Infinity,
  });

  const result = query.data?.results[widgetId];
  if (result?.ok) return { status: "ready", data: result.data as T };
  if (query.isPending) return { status: "loading" };
  return { status: "error" };
}
