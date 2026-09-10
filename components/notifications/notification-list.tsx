import { Bell } from "lucide-react";
import { NotificationItem, type NotificationEntry } from "./notification-item";

interface NotificationListProps {
  notifications: NotificationEntry[];
  loading: boolean;
  onOpen: (notification: NotificationEntry) => void;
  emptyLabel: string;
}

export function NotificationList({ notifications, loading, onOpen, emptyLabel }: NotificationListProps) {
  if (loading) {
    return <div className="p-6 text-center text-xs text-slate-400">…</div>;
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-2 text-slate-400">
        <Bell className="w-6 h-6" />
        <p className="text-xs">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onOpen={onOpen} />
      ))}
    </div>
  );
}
