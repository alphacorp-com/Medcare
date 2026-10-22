"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMaternityError } from "@/components/maternity/use-maternity-error";
import { NeonatalDeathFields } from "./NeonatalDeathFields";
import type { Newborn } from "../../types";

// Neonatal follow-up after the birth: kangaroo care, incubator, death (date, cause) and the
// death review (RMA3 II.1.4-007 to 023).
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

export function NewbornFollowUpDialog({ newborn, onOpenChange, onSaved }: { newborn: Newborn; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");
  const errorMessage = useMaternityError();
  const [kangarooCare, setKangarooCare] = useState(newborn.kangarooCare);
  const [incubatorCare, setIncubatorCare] = useState(newborn.incubatorCare);
  const [died, setDied] = useState(newborn.outcome === "neonatal_death");
  const [diedAt, setDiedAt] = useState(toLocalInput(newborn.diedAt));
  const [deathCause, setDeathCause] = useState(newborn.deathCause ?? "");
  const [reviewedAt, setReviewedAt] = useState(newborn.deathReviewedAt?.slice(0, 10) ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/maternity/newborns/${newborn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kangarooCare,
          incubatorCare,
          died,
          ...(died ? { diedAt: diedAt ? new Date(diedAt).toISOString() : undefined, deathCause: deathCause || null, deathReviewedAt: reviewedAt || null } : {}),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(payload, t("newborn_save_error")));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError(t("newborn_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newborn_follow_up")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={kangarooCare} onChange={(e) => setKangarooCare(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t("kangaroo_care")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={incubatorCare} onChange={(e) => setIncubatorCare(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t("incubator_care")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={died} onChange={(e) => setDied(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t("newborn_died")}
          </label>
          {died && (
            <>
              <NeonatalDeathFields diedAt={diedAt} onDiedAt={setDiedAt} cause={deathCause} onCause={setDeathCause} />
              <div className="space-y-1">
                <Label>{t("death_reviewed_on")}</Label>
                <Input type="date" value={reviewedAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setReviewedAt(e.target.value)} className="h-9 text-xs" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={isSaving} onClick={handleSave} className="bg-pink-600 text-white hover:bg-pink-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
