"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import { ConversationAvatar, conversationName, formatListTimestamp } from "./chat-utils";

export interface ConversationSummary {
  id: string;
  title: string | null;
  isGroup: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  participants: { id: string; fullName: string; email: string }[];
}

interface ConversationListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyLabel: string;
}

export function ConversationList({ conversations, loading, selectedId, onSelect, emptyLabel }: ConversationListProps) {
  const t = useTranslations("messages");
  const locale = useLocale();

  if (loading && conversations.length === 0) {
    return (
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex animate-pulse items-center gap-3 px-4 py-3">
            <div className="h-12 w-12 rounded-full bg-slate-200 md:h-10 md:w-10" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-slate-200" />
              <div className="h-3 w-3/4 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-slate-400">
        <MessageSquare className="h-8 w-8" />
        <p className="text-xs">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => {
        const unread = conversation.unreadCount > 0;
        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelect(conversation.id)}
            className={cn(
              "flex w-full items-center gap-3 px-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100",
              selectedId === conversation.id && "bg-blue-50 hover:bg-blue-50"
            )}
          >
            <ConversationAvatar conversation={conversation} className="h-12 w-12 text-base md:h-10 md:w-10 md:text-sm" />
            {/* Separator starts after the avatar, as in most messaging apps. */}
            <div className="min-w-0 flex-1 border-b border-slate-100 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn("truncate text-[15px] md:text-sm", unread ? "font-bold text-slate-900" : "font-semibold text-slate-800")}>
                  {conversationName(conversation)}
                </p>
                {conversation.lastMessageAt && (
                  <span className={cn("shrink-0 text-[11px]", unread ? "font-semibold text-blue-600" : "text-slate-400")}>
                    {formatListTimestamp(new Date(conversation.lastMessageAt), locale, t("yesterday"))}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className={cn("truncate text-[13px] md:text-xs", unread ? "font-medium text-slate-700" : "text-slate-500")}>
                  {conversation.lastMessagePreview ?? "—"}
                </p>
                {unread && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
