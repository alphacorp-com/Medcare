"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMaternityError } from "@/components/maternity/use-maternity-error";
import type { PregnancyDetail } from "../../types";

// End of a pregnancy without delivery (miscarriage / termination, post-abortion care) and
// maternal death (date, cause, review) — RMA3 II.1.2-012 to 024.
const MATERNAL_DEATH_CAUSES = ["hemorrhage", "obstructed_labour", "preeclampsia_eclampsia", "uterine_rupture", "puerperal_infection", "abortion", "other"] as const;
const selectClass = "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400";
const today = () => new Date().toISOString().slice(0, 10);

export function PregnancyOutcomeDialog({ pregnancy, onOpenChange, onSaved }: { pregnancy: PregnancyDetail; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");
  const errorMessage = useMaternityError();
  const delivered = Boolean(pregnancy.delivery?.deliveryDate);
  const [status, setStatus] = useState(pregnancy.status === "delivered" ? "delivered" : pregnancy.status);
  const [endedAt, setEndedAt] = useState(pregnancy.endedAt?.slice(0, 10) ?? "");
  const [abortionCare, setAbortionCare] = useState(pregnancy.abortionCare ?? "");
  const [died, setDied] = useState(Boolean(pregnancy.maternalDeathAt));
  const [deathAt, setDeathAt] = useState(pregnancy.maternalDeathAt?.slice(0, 10) ?? "");
  const [cause, setCause] = useState(pregnancy.maternalDeathCause ?? "");
  const [reviewedAt, setReviewedAt] = useState(pregnancy.maternalDeathReviewedAt?.slice(0, 10) ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/maternity/pregnancies/${pregnancy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The status of a delivered pregnancy comes from its delivery.
          ...(delivered ? {} : { status, endedAt: status === "ongoing" ? undefined : endedAt, abortionCare: status === "ongoing" ? null : abortionCare || null }),
          maternalDeath: died ? { at: deathAt, cause, reviewedAt: reviewedAt || null } : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(payload, t("outcome_save_error")));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError(t("outcome_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pregnancy_outcome")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          {!delivered && (
            <>
              <div className="space-y-1">
                <Label>{t("pregnancy_status")}</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
                  <option value="ongoing">{t("ongoing")}</option>
                  <option value="miscarried">{t("miscarried")}</option>
                  <option value="terminated">{t("terminated")}</option>
                </select>
              </div>
              {status !== "ongoing" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>{t("pregnancy_end_date")}</Label>
                    <Input type="date" value={endedAt} max={today()} onChange={(e) => setEndedAt(e.target.value)} className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("abortion_care")}</Label>
                    <select value={abortionCare} onChange={(e) => setAbortionCare(e.target.value as typeof abortionCare)} className={selectClass}>
                      <option value="">—</option>
                      <option value="uncomplicated">{t("abortion_care_uncomplicated")}</option>
                      <option value="complicated">{t("abortion_care_complicated")}</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={died} onChange={(e) => setDied(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t("maternal_death")}
          </label>
          {died && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{t("death_date")}</Label>
                <Input type="date" value={deathAt} max={today()} onChange={(e) => setDeathAt(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <Label>{t("death_cause")}</Label>
                <select value={cause} onChange={(e) => setCause(e.target.value)} className={selectClass}>
                  <option value="">{tc("select_placeholder")}</option>
                  {MATERNAL_DEATH_CAUSES.map((c) => (
                    <option key={c} value={c}>{t(`maternal_cause_${c}`)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>{t("death_reviewed_on")}</Label>
                <Input type="date" value={reviewedAt} max={today()} onChange={(e) => setReviewedAt(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-400">{t("maternal_death_hint")}</p>
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
