"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const PTME_PANELS = [
  { code: "HIV", key: "hiv" },
  { code: "SYPH", key: "syphilis" },
] as const;

export function PrescribePtmeDialog({
  open,
  onOpenChange,
  patientId,
  pregnancyId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  pregnancyId: string;
  onSaved: () => void;
}) {
  const t = useTranslations("maternity");

  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prescribe = async (panelCode: string) => {
    setIsSaving(panelCode);
    setError(null);
    try {
      const res = await fetch("/api/v1/laboratory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, pregnancyId, panelCode, urgency: "routine" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("ptme_prescribe_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("ptme_prescribe_error"));
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("prescribe_ptme")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
          <p className="text-xs text-slate-500">{t("prescribe_ptme_desc")}</p>
          <div className="flex flex-col gap-2">
            {PTME_PANELS.map((panel) => (
              <Button
                key={panel.code}
                type="button"
                variant="outline"
                disabled={isSaving !== null}
                onClick={() => prescribe(panel.code)}
                className="justify-start"
              >
                {isSaving === panel.code ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t(`ptme_test_${panel.key}`)}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
