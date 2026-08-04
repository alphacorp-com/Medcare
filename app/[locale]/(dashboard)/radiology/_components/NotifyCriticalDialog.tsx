"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BellRing, Loader2 } from "lucide-react";
import { RadiologyExam } from "../types";

const METHODS = ["phone", "in_person", "secure_message"] as const;

export function NotifyCriticalDialog({
  open,
  onOpenChange,
  exam,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: RadiologyExam | null;
  onDone: () => void;
}) {
  const t = useTranslations("radiology");
  const tc = useTranslations("common");

  const [notifiedTo, setNotifiedTo] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("phone");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!exam) return null;

  const handleConfirm = async () => {
    if (!notifiedTo.trim()) {
      setError(t("notified_to_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/radiology/${exam.id}/notify-critical`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifiedTo, method: t(`notify_methods.${method}`) }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("notify_error"));
        return;
      }
      setNotifiedTo("");
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(t("notify_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-800">
            <BellRing className="h-4 w-4 text-red-600" /> {t("notify_critical")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
          <p className="text-xs text-slate-500">{t("notify_critical_desc")}</p>
          <div className="space-y-1">
            <Label>{t("notified_to")}</Label>
            <Input value={notifiedTo} onChange={(e) => setNotifiedTo(e.target.value)} placeholder={t("notified_to_placeholder")} className="h-9 text-xs" />
          </div>
          <div className="space-y-1">
            <Label>{t("notify_method")}</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>{t(`notify_methods.${m}`)}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={isSaving} onClick={handleConfirm} className="bg-red-600 text-white hover:bg-red-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("confirm_notification")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
