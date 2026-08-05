"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Colleague {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface NewConversationDialogProps {
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ onCreated }: NewConversationDialogProps) {
  const t = useTranslations("messages");
  const [open, setOpen] = useState(false);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/v1/directory")
      .then((res) => (res.ok ? res.json() : []))
      .then(setColleagues)
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = colleagues.filter((c) =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleStart = async () => {
    if (selectedIds.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: selectedIds }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.id);
        setOpen(false);
        setSelectedIds([]);
        setSearch("");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="w-4 h-4" /> {t("new_conversation")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("new_conversation")}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 h-9"
            placeholder={t("search_colleagues")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400">…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">{t("no_colleagues")}</div>
          ) : (
            filtered.map((colleague) => {
              const checked = selectedIds.includes(colleague.id);
              return (
                <button
                  key={colleague.id}
                  type="button"
                  onClick={() => toggle(colleague.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50",
                    checked && "bg-blue-50"
                  )}
                >
                  <input type="checkbox" checked={checked} readOnly className="rounded border-slate-300" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{colleague.fullName}</p>
                    <p className="text-xs text-slate-400 truncate">{colleague.email}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleStart}
            disabled={selectedIds.length === 0 || creating}
            className="w-full sm:w-auto"
          >
            {creating ? t("starting") : t("start_conversation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
