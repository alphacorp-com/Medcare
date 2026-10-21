"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { shouldRetry } from "@/lib/api-client";

// One QueryClient per browser session (created once per mount, never shared between
// requests on the server). Defaults chosen for this app:
//  - staleTime 30 s: navigating back to a page shows its cached data instantly, then
//    refreshes it in the background once it's older than that;
//  - polling (refetchInterval) pauses while the tab is hidden — TanStack's default
//    refetchIntervalInBackground: false — so idle tabs stop hitting the server;
//  - no retry on 4xx (see shouldRetry).
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: shouldRetry,
            refetchOnWindowFocus: true,
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
