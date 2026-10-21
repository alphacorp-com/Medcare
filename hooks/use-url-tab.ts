"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// The active tab of a page, kept in the URL (?tab=…) so that the sidebar's sub-items (and
// any link) open a given tab, even when the page is already displayed. An unknown or absent
// value falls back to `fallback`. Requires the calling page to be wrapped in <Suspense>.
export function useUrlTab<T extends string>(allowed: readonly T[], fallback: T): [T, (tab: T) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const value = searchParams.get("tab");
  const tab = value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

  const setTab = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return [tab, setTab];
}
