"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Send, MessageSquare } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";

interface MessageEntry {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; fullName: string };
}

interface MessageThreadProps {
  conversationId: string | null;
  onMessageSent: () => void;
}

const POLL_INTERVAL_MS = 4000;

export function MessageThread({ conversationId, onMessageSent }: MessageThreadProps) {
  const t = useTranslations("messages");
  const currentUser = useAppStore((s) => s.currentUser);
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    const res = await fetch(`/api/v1/conversations/${conversationId}/messages`);
    if (res.ok) {
      setMessages(await res.json());
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    fetchMessages();
    fetch(`/api/v1/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !conversationId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        await fetchMessages();
        onMessageSent();
      }
    } finally {
      setSending(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300">
        <MessageSquare className="w-10 h-10" />
        <p className="text-sm text-slate-400">{t("select_conversation")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => {
          const isSelf = message.senderId === currentUser?.id;
          return (
            <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 ${isSelf ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                {!isSelf && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{message.sender.fullName}</p>}
                <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                <p className={`text-[10px] mt-1 ${isSelf ? "text-blue-100" : "text-slate-400"}`}>
                  {format(new Date(message.createdAt), "h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-200 p-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t("type_message")}
          className="flex-1 h-10 px-3 rounded-md border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        />
        <Button size="icon" onClick={handleSend} disabled={!draft.trim() || sending}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
