import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export interface NotificationEntry {
  id: string;
  type: "module_event" | "message" | "system";
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationItemProps {
  notification: NotificationEntry;
  onOpen: (notification: NotificationEntry) => void;
}

export function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        "w-full text-left px-3 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors flex gap-2.5",
        !notification.isRead && "bg-blue-50/50"
      )}
    >
      <span
        className={cn(
          "mt-1.5 h-2 w-2 rounded-full shrink-0",
          notification.isRead ? "bg-transparent" : "bg-blue-600"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm truncate", notification.isRead ? "text-slate-600" : "font-semibold text-slate-900")}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{notification.body}</p>
        )}
        <p className="text-[11px] text-slate-400 mt-0.5">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}
