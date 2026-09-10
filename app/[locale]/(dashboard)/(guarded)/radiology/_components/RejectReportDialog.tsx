"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { RadiologyExam } from "../types";

export function RejectReportDialog({
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

  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!exam) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(t("reason_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/radiology/${exam.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("reject_error"));
        return;
      }
      setReason("");
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(t("reject_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reject_report")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
          <p className="text-sm text-slate-600">{exam.examLabel} — {exam.patient.firstName} {exam.patient.lastName}</p>
          <p className="text-xs text-slate-500">{t("reject_report_desc")}</p>
          <div className="space-y-2">
            <Label>{t("reason")}</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={isSaving} onClick={handleConfirm} className="bg-red-600 text-white hover:bg-red-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("reject_report")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
