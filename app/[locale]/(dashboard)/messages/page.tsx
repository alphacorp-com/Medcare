"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ConversationList, type ConversationSummary } from "./_components/ConversationList";
import { MessageThread } from "./_components/MessageThread";
import { NewConversationDialog } from "./_components/NewConversationDialog";

const POLL_INTERVAL_MS = 15000;

export default function MessagesPage() {
  const t = useTranslations("messages");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <div className="flex h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h1 className="text-sm font-bold text-slate-900">{t("title")}</h1>
          <NewConversationDialog onCreated={(id) => { loadConversations(); setSelectedId(id); }} />
        </div>
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          emptyLabel={t("no_conversations")}
        />
      </div>
      <MessageThread conversationId={selectedId} onMessageSent={loadConversations} />
    </div>
  );
}
