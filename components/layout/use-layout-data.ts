"use client";

import { useEffect, useState } from "react";

// Several layout pieces (headers, sidebar, bottom nav) can mount at the same time and ask
// for the same data; concurrent requests for one URL share a single fetch.
const inFlight = new Map<string, Promise<unknown>>();

function fetchJsonShared<T>(url: string): Promise<T | null> {
  let request = inFlight.get(url) as Promise<T | null> | undefined;
  if (!request) {
    request = fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
      .catch(() => null)
      .finally(() => inFlight.delete(url));
    inFlight.set(url, request);
  }
  return request;
}

export type OrganizationInfo = { name: string; address: string; logoUrl: string };

export function useOrganizationInfo() {
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);

  useEffect(() => {
    let active = true;
    fetchJsonShared<Partial<OrganizationInfo>>("/api/v1/settings/organization").then((data) => {
      if (!active || !data) return;
      setOrganization({ name: data.name || "", address: data.address || "", logoUrl: data.logoUrl || "" });
    });
    return () => {
      active = false;
    };
  }, []);

  return organization;
}

// The unread-messages badge lives in hooks/use-unread-counts.ts (one shared, cached,
// visibility-aware query); re-exported here so the layout imports stay unchanged.
export { useUnreadMessagesCount } from "@/hooks/use-unread-counts";
