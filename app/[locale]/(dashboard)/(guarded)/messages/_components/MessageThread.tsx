"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatDayLabel, formatTime, isSameDay } from "./chat-utils";

interface MessageEntry {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; fullName: string };
}

interface MessageThreadProps {
  conversationId: string | null;
  isGroup?: boolean;
  onMessageSent: () => void;
}

const POLL_INTERVAL_MS = 4000;
// Consecutive messages from the same sender within this window are visually grouped.
const GROUP_WINDOW_MS = 5 * 60 * 1000;
// Distance from the bottom under which the thread keeps following new messages.
const STICK_TO_BOTTOM_PX = 80;
const COMPOSER_MAX_HEIGHT_PX = 120;

export function MessageThread({ conversationId, isGroup = false, onMessageSent }: MessageThreadProps) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const currentUser = useAppStore((s) => s.currentUser);
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    const res = await fetch(`/api/v1/conversations/${conversationId}/messages`);
    if (res.ok) {
      setMessages(await res.json());
    }
    setLoaded(true);
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setLoaded(false);
    stickToBottom.current = true;
    if (!conversationId) return;
    fetchMessages();
    fetch(`/api/v1/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId, fetchMessages]);

  // Follow new messages only while the reader is already at the bottom — polling must not
  // yank them back down while they scroll through history.
  const lastMessageId = messages[messages.length - 1]?.id;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && lastMessageId && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastMessageId]);

  // Grow the composer with its content, up to a few lines.
  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [draft]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !conversationId || sending) return;
    setSending(true);
    setDraft("");
    stickToBottom.current = true;
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        await fetchMessages();
        onMessageSent();
      } else {
        setDraft(text);
      }
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  };

  if (!conversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-slate-50 text-slate-300">
        <MessageSquare className="h-10 w-10" />
        <p className="text-sm text-slate-400">{t("select_conversation")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-slate-100">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-4 md:px-6">
        {!loaded ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const createdAt = new Date(message.createdAt);
            const isSelf = message.senderId === currentUser?.id;
            const startsDay = !previous || !isSameDay(new Date(previous.createdAt), createdAt);
            const continuesGroup =
              !startsDay &&
              previous.senderId === message.senderId &&
              createdAt.getTime() - new Date(previous.createdAt).getTime() < GROUP_WINDOW_MS;
            const endsGroup =
              !next ||
              next.senderId !== message.senderId ||
              !isSameDay(new Date(next.createdAt), createdAt) ||
              new Date(next.createdAt).getTime() - createdAt.getTime() >= GROUP_WINDOW_MS;

            return (
              <Fragment key={message.id}>
                {startsDay && (
                  <div className="my-3 flex justify-center first:mt-0">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                      {formatDayLabel(createdAt, locale, { today: t("today"), yesterday: t("yesterday") })}
                    </span>
                  </div>
                )}
                <div className={cn("flex", isSelf ? "justify-end" : "justify-start", continuesGroup ? "mt-0.5" : "mt-2")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm md:max-w-[65%]",
                      isSelf ? "bg-blue-600 text-white" : "bg-white text-slate-800",
                      endsGroup && (isSelf ? "rounded-br-md" : "rounded-bl-md")
                    )}
                  >
                    {isGroup && !isSelf && !continuesGroup && (
                      <p className="mb-0.5 text-[11px] font-semibold text-blue-700">{message.sender.fullName}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-snug md:text-sm">
                      {message.body}
                      {/* Reserves room so the timestamp can sit on the last line, as in chat apps. */}
                      <span className="invisible ml-2 text-[10px]" aria-hidden>{formatTime(createdAt, locale)}</span>
                    </p>
                    <p className={cn("-mt-3.5 text-right text-[10px] leading-none", isSelf ? "text-blue-100" : "text-slate-400")}>
                      {formatTime(createdAt, locale)}
                    </p>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-slate-200 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <textarea
          ref={composerRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Desktop: Enter sends, Shift+Enter breaks the line. Mobile keyboards keep Enter
            // as a line break and send with the button, like WhatsApp or Messenger.
            if (!isMobile && e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t("type_message")}
          className="min-h-10 flex-1 resize-none rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] leading-5 focus-visible:border-blue-300 focus-visible:outline-none md:text-sm"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          aria-label={t("send")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-300"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -translate-x-px translate-y-px" />}
        </button>
      </div>
    </div>
  );
}
