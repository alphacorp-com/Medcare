import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "./ConversationList";

export function conversationName(conversation: ConversationSummary): string {
  if (conversation.isGroup) {
    return conversation.title || conversation.participants.map((p) => p.fullName).join(", ");
  }
  return conversation.participants[0]?.fullName ?? "—";
}

// Secondary line under a conversation name: the other person's email, or the members of a group.
export function conversationSubtitle(conversation: ConversationSummary): string {
  if (conversation.isGroup) return conversation.participants.map((p) => p.fullName).join(", ");
  return conversation.participants[0]?.email ?? "";
}

const AVATAR_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600",
  "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600",
];

// Stable colour per name, so a contact keeps the same avatar colour everywhere.
function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function ConversationAvatar({ conversation, className }: { conversation: ConversationSummary; className?: string }) {
  const name = conversationName(conversation);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        avatarColor(conversation.isGroup ? conversation.id : name),
        className
      )}
    >
      {conversation.isGroup ? <Users className="h-1/2 w-1/2" /> : initials(name)}
    </div>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(date: Date) {
  return Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
}

export function formatTime(date: Date, locale: string) {
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

// Timestamp shown in the conversation list: time today, "Yesterday", weekday this week, else a short date.
export function formatListTimestamp(date: Date, locale: string, yesterdayLabel: string) {
  const days = daysAgo(date);
  if (days === 0) return formatTime(date, locale);
  if (days === 1) return yesterdayLabel;
  if (days < 7) return date.toLocaleDateString(locale, { weekday: "short" });
  return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Label of the date separator inside a thread.
export function formatDayLabel(date: Date, locale: string, labels: { today: string; yesterday: string }) {
  const days = daysAgo(date);
  if (days === 0) return labels.today;
  if (days === 1) return labels.yesterday;
  return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a) === startOfDay(b);
}
