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

const UNREAD_POLL_INTERVAL_MS = 15000;

export function useUnreadMessagesCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const conversations = await fetchJsonShared<Array<{ unreadCount?: number }>>("/api/v1/conversations");
      if (!active || !conversations) return;
      setCount(conversations.reduce((sum, conversation) => sum + (conversation.unreadCount ?? 0), 0));
    };

    refresh();
    const interval = window.setInterval(refresh, UNREAD_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return count;
}
