"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { unreadQueryKeys, useUnreadNotificationsCount } from "@/hooks/use-unread-counts";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationList } from "./notification-list";
import type { NotificationEntry } from "./notification-item";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const queryClient = useQueryClient();
  // Shared, cached badge query (polled every 30 s, paused while the tab is hidden).
  const unreadCount = useUnreadNotificationsCount();
  const setUnreadCount = (update: (count: number) => number) =>
    queryClient.setQueryData<{ count: number }>(unreadQueryKeys.notifications, (prev) => ({ count: update(prev?.count ?? 0) }));
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications?take=15");
      if (res.ok) {
        setNotifications(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) fetchNotifications();
  };

  const handleOpenNotification = async (notification: NotificationEntry) => {
    if (!notification.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      fetch(`/api/v1/notifications/${notification.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(() => 0);
    try {
      await fetch("/api/v1/notifications/read-all", { method: "POST" });
    } catch {
      // best-effort — next poll will reconcile
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger className="relative flex items-center justify-center h-8 w-8 rounded-full hover:bg-slate-100 focus:outline-none">
        <Bell className="w-4.5 h-4.5 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">{t("title")}</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] font-medium text-blue-600 hover:underline"
            >
              {t("mark_all_read")}
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <NotificationList
          notifications={notifications}
          loading={loading}
          onOpen={handleOpenNotification}
          emptyLabel={t("empty")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
