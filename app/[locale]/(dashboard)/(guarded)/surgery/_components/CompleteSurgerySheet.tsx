"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { Surgery } from "../types";
import { notifyBillingGenerated } from "@/lib/billing/client";

const COMPLICATION_OPTIONS = [
  "bleeding",
  "infection",
  "anesthesia_reaction",
  "organ_injury",
  "none",
] as const;

export function CompleteSurgerySheet({
  open,
  onOpenChange,
  surgery,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surgery: Surgery | null;
  onCompleted: () => void;
}) {
  const t = useTranslations("surgery");
  const tc = useTranslations("common");

  const [surgicalReport, setSurgicalReport] = useState("");
  const [anesthesiaReport, setAnesthesiaReport] = useState("");
  const [complications, setComplications] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!surgery) return null;

  const toggleComplication = (key: string) => {
    setComplications((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/surgeries/${surgery.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surgicalReport, anesthesiaReport: anesthesiaReport || undefined, complications }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || t("complete_error"));
        return;
      }
      notifyBillingGenerated(payload?.billing, tc("invoice_generated"));
      setSurgicalReport("");
      setAnesthesiaReport("");
      setComplications([]);
      onCompleted();
      onOpenChange(false);
    } catch (err) {
      setError(t("complete_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("complete_sign")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="space-y-2">
            <Label>{t("surgical_report")}</Label>
            <textarea
              required
              value={surgicalReport}
              onChange={(e) => setSurgicalReport(e.target.value)}
              rows={5}
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              placeholder={t("surgical_report_placeholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("anesthesia_report")}</Label>
            <textarea
              value={anesthesiaReport}
              onChange={(e) => setAnesthesiaReport(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("complications")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {COMPLICATION_OPTIONS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={complications.includes(key)}
                    onChange={() => toggleComplication(key)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {t(`complication_options.${key}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
            <Button type="submit" disabled={isSaving} className="bg-green-600 text-white hover:bg-green-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("complete_sign")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
