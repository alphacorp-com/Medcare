"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConversationList, type ConversationSummary } from "./_components/ConversationList";
import { MessageThread } from "./_components/MessageThread";
import { NewConversationDialog } from "./_components/NewConversationDialog";
import { ConversationAvatar, conversationName, conversationSubtitle } from "./_components/chat-utils";

const POLL_INTERVAL_MS = 15000;

export default function MessagesPage() {
  const t = useTranslations("messages");
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/conversations");
      if (res.ok) {
        setConversations(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  };

  const handleCreated = (id: string) => {
    loadConversations();
    setSelectedId(id);
  };

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  if (isMobile) {
    // Conversation screen: full screen over the app chrome, like a native messaging app.
    if (selectedId) {
      return (
        // z-60 sits above the mobile bottom nav (z-50), which would otherwise cover the composer.
        <div className="fixed inset-0 z-60 flex h-dvh flex-col bg-white">
          <header className="flex shrink-0 items-center gap-2 bg-blue-800 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
              aria-label={t("back_to_list")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            {selected && (
              <>
                <ConversationAvatar conversation={selected} className="h-9 w-9 text-sm ring-2 ring-white/20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-tight">{conversationName(selected)}</p>
                  <p className="truncate text-xs text-blue-100">{conversationSubtitle(selected)}</p>
                </div>
              </>
            )}
          </header>
          <MessageThread conversationId={selectedId} isGroup={selected?.isGroup} onMessageSent={loadConversations} />
        </div>
      );
    }

    const query = search.trim().toLowerCase();
    const filtered = query
      ? conversations.filter((c) =>
          conversationName(c).toLowerCase().includes(query) ||
          (c.lastMessagePreview ?? "").toLowerCase().includes(query)
        )
      : conversations;

    // Conversation list: edge to edge inside the mobile card (cancels its padding).
    return (
      <div className="-m-3 flex min-h-[70vh] flex-col">
        <div className="space-y-3 px-4 pb-2 pt-4">
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_conversations")}
              className="h-10 w-full rounded-full bg-slate-100 pl-10 pr-4 text-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            />
          </div>
        </div>

        <ConversationList
          conversations={filtered}
          loading={loading}
          selectedId={null}
          onSelect={handleSelect}
          emptyLabel={query ? t("no_results") : t("no_conversations")}
        />

        <NewConversationDialog variant="fab" onCreated={handleCreated} />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h1 className="text-sm font-bold text-slate-900">{t("title")}</h1>
          <NewConversationDialog onCreated={handleCreated} />
        </div>
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          emptyLabel={t("no_conversations")}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {selected && (
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
            <ConversationAvatar conversation={selected} className="h-9 w-9 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{conversationName(selected)}</p>
              <p className="truncate text-xs text-slate-500">{conversationSubtitle(selected)}</p>
            </div>
          </div>
        )}
        <MessageThread conversationId={selectedId} isGroup={selected?.isGroup} onMessageSent={loadConversations} />
      </div>
    </div>
  );
}
