"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Navigation badges. Every component showing the same badge (sidebar, mobile header,
// bottom nav) shares one cached query, polled every 30 s — and not at all while the tab is
// hidden (TanStack pauses refetchInterval in the background by default).

const BADGE_POLL_MS = 30_000;

export const unreadQueryKeys = {
  messages: ["badges", "unread-messages"] as const,
  notifications: ["badges", "unread-notifications"] as const,
};

export function useUnreadMessagesCount(): number {
  const query = useQuery({
    queryKey: unreadQueryKeys.messages,
    queryFn: () => apiFetch<{ count: number }>("/api/v1/conversations/unread-count"),
    refetchInterval: BADGE_POLL_MS,
    staleTime: BADGE_POLL_MS,
  });
  return query.data?.count ?? 0;
}

export function useUnreadNotificationsCount(): number {
  const query = useQuery({
    queryKey: unreadQueryKeys.notifications,
    queryFn: () => apiFetch<{ count: number }>("/api/v1/notifications/unread-count"),
    refetchInterval: BADGE_POLL_MS,
    staleTime: BADGE_POLL_MS,
  });
  return query.data?.count ?? 0;
}
