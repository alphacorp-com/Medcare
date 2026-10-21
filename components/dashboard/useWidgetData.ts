"use client";

import { useEffect, useState } from "react";
import type { WidgetData } from "@/lib/dashboard/widget-data";

type WidgetState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

// Fetches one generic widget from /api/v1/dashboard/widgets/[id] and refreshes it every
// refreshMs (0 = no refresh). A failed refresh keeps showing the last good data rather
// than replacing it with an error.
export function useWidgetData<T extends WidgetData>(widgetId: string, refreshMs: number): WidgetState<T> {
  const [state, setState] = useState<WidgetState<T>>({ status: "loading" });

  useEffect(() => {
    let controller = new AbortController();

    const load = async () => {
      // Cancel a still-running previous fetch so a slow response can't overwrite a newer one.
      controller.abort();
      const current = new AbortController();
      controller = current;
      try {
        const res = await fetch(`/api/v1/dashboard/widgets/${widgetId}`, { signal: current.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        setState({ status: "ready", data });
      } catch (error) {
        if (current.signal.aborted) return;
        console.error(`[dashboard widget ${widgetId}]`, error);
        setState((previous) => (previous.status === "ready" ? previous : { status: "error" }));
      }
    };

    load();
    const interval = refreshMs > 0 ? setInterval(load, refreshMs) : undefined;
    return () => {
      controller.abort();
      if (interval) clearInterval(interval);
    };
  }, [widgetId, refreshMs]);

  return state;
}
