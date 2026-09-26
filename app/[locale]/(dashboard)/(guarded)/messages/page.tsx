"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ConversationList, type ConversationSummary } from "./_components/ConversationList";
import { MessageThread } from "./_components/MessageThread";
import { NewConversationDialog } from "./_components/NewConversationDialog";
import { ArrowLeft } from "lucide-react";

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

  if (selectedId) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <div className="max-w-full w-full h-full flex flex-col">
          <div className="p-3 border-b border-slate-100 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="p-2 rounded hover:bg-slate-100"
              aria-label={t("back_to_list")}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {conversations.find((c) => c.id === selectedId)?.title || conversations.find((c) => c.id === selectedId)?.participants.map((p) => p.fullName).join(", ")}
            </h2>
          </div>
          <div className="h-full">
            <MessageThread conversationId={selectedId} onMessageSent={loadConversations} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white border-b border-slate-200 px-3 py-3 sm:px-4 shrink-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          </div>

          <div className="w-full lg:w-auto">
            <div className="flex items-center justify-end gap-2">
              <NewConversationDialog onCreated={(id) => { loadConversations(); setSelectedId(id); }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          emptyLabel={t("no_conversations")}
        />
      </div>
    </div>
  );
}
