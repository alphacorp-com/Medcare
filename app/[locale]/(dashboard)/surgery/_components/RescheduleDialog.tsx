"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Surgery, SurgeryConflict } from "../types";

export function RescheduleDialog({
  open,
  onOpenChange,
  surgery,
  onRescheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surgery: Surgery | null;
  onRescheduled: () => void;
}) {
  const t = useTranslations("surgery");
  const tc = useTranslations("common");

  const [scheduledAt, setScheduledAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SurgeryConflict[] | null>(null);

  if (!surgery) return null;

  const submit = async (force = false) => {
    setIsSaving(true);
    setError(null);
    if (!force) setConflicts(null);
    try {
      const res = await fetch(`/api/v1/surgeries/${surgery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, force }),
      });
      if (res.status === 409) {
        const payload = await res.json();
        setConflicts(payload.conflicts ?? []);
        return;
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("reschedule_error"));
        return;
      }
      setScheduledAt("");
      onRescheduled();
      onOpenChange(false);
    } catch (err) {
      setError(t("reschedule_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reschedule_surgery")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
          <p className="text-sm text-slate-600">{surgery.procedureLabel} — {surgery.patient.firstName} {surgery.patient.lastName}</p>
          <div className="space-y-2">
            <Label>{tc("date")} & {tc("time")}</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          {conflicts && conflicts.length > 0 && (
            <div className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded p-3 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> {t("scheduling_conflict")}
              </div>
              <ul className="space-y-1 list-disc list-inside">
                {conflicts.map((c) => (
                  <li key={c.procedureId}>
                    {t(`conflict_${c.resource}`)} — {c.procedureLabel} ({c.patientName})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          {conflicts && conflicts.length > 0 ? (
            <Button disabled={isSaving} onClick={() => submit(true)} className="bg-orange-600 text-white hover:bg-orange-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("schedule_anyway")}
            </Button>
          ) : (
            <Button disabled={isSaving || !scheduledAt} onClick={() => submit(false)} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("reschedule_surgery")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
