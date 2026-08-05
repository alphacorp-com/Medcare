import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

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

function displayName(conversation: ConversationSummary): string {
  if (conversation.isGroup) {
    return conversation.title || conversation.participants.map((p) => p.fullName).join(", ");
  }
  return conversation.participants[0]?.fullName ?? "—";
}

export function ConversationList({ conversations, loading, selectedId, onSelect, emptyLabel }: ConversationListProps) {
  if (loading && conversations.length === 0) {
    return <div className="p-6 text-center text-xs text-slate-400">…</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-2 text-slate-400">
        <MessageSquare className="w-8 h-8" />
        <p className="text-xs">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          type="button"
          onClick={() => onSelect(conversation.id)}
          className={cn(
            "w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex items-start gap-3",
            selectedId === conversation.id && "bg-blue-50 hover:bg-blue-50"
          )}
        >
          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold shrink-0">
            {displayName(conversation).charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className={cn("text-sm truncate", conversation.unreadCount > 0 ? "font-bold text-slate-900" : "font-medium text-slate-700")}>
                {displayName(conversation)}
              </p>
              {conversation.lastMessageAt && (
                <span className="text-[10px] text-slate-400 shrink-0">
                  {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-xs text-slate-500 truncate">{conversation.lastMessagePreview ?? "—"}</p>
              {conversation.unreadCount > 0 && (
                <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
