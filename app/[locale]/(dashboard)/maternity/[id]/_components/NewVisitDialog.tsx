"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export function NewVisitDialog({
  open,
  onOpenChange,
  pregnancyId,
  suggestedGestationalAge,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  suggestedGestationalAge: number;
  onSaved: () => void;
}) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");

  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(String(suggestedGestationalAge));
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState("");
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState("");
  const [weight, setWeight] = useState("");
  const [fundalHeightCm, setFundalHeightCm] = useState("");
  const [fetalHeartRate, setFetalHeartRate] = useState("");
  const [ironFolateGiven, setIronFolateGiven] = useState(false);
  const [tetanusVaccineGiven, setTetanusVaccineGiven] = useState(false);
  const [malariaPreventionGiven, setMalariaPreventionGiven] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!gestationalAgeWeeks) {
      setError(t("gestational_age_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/maternity/pregnancies/${pregnancyId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gestationalAgeWeeks: Number(gestationalAgeWeeks),
          bloodPressureSystolic: bloodPressureSystolic || undefined,
          bloodPressureDiastolic: bloodPressureDiastolic || undefined,
          weight: weight || undefined,
          fundalHeightCm: fundalHeightCm || undefined,
          fetalHeartRate: fetalHeartRate || undefined,
          ironFolateGiven,
          tetanusVaccineGiven,
          malariaPreventionGiven,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("visit_save_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("visit_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("new_visit")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="space-y-1">
            <Label>{t("gestational_age_weeks")}</Label>
            <Input type="number" value={gestationalAgeWeeks} onChange={(e) => setGestationalAgeWeeks(e.target.value)} className="h-9 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder={t("bp_systolic")} value={bloodPressureSystolic} onChange={(e) => setBloodPressureSystolic(e.target.value)} className="h-9 text-xs" />
            <Input type="number" placeholder={t("bp_diastolic")} value={bloodPressureDiastolic} onChange={(e) => setBloodPressureDiastolic(e.target.value)} className="h-9 text-xs" />
            <Input type="number" step="0.1" placeholder={t("weight_kg")} value={weight} onChange={(e) => setWeight(e.target.value)} className="h-9 text-xs" />
            <Input type="number" step="0.1" placeholder={t("fundal_height_cm")} value={fundalHeightCm} onChange={(e) => setFundalHeightCm(e.target.value)} className="h-9 text-xs" />
            <Input type="number" placeholder={t("fetal_heart_rate")} value={fetalHeartRate} onChange={(e) => setFetalHeartRate(e.target.value)} className="h-9 text-xs col-span-2" />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={ironFolateGiven} onChange={(e) => setIronFolateGiven(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("iron_folate_given")}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={tetanusVaccineGiven} onChange={(e) => setTetanusVaccineGiven(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("tetanus_vaccine_given")}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={malariaPreventionGiven} onChange={(e) => setMalariaPreventionGiven(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("malaria_prevention_given")}
            </label>
          </div>

          <div className="space-y-1">
            <Label>{t("notes")}</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={isSaving} onClick={handleSave} className="bg-pink-600 text-white hover:bg-pink-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("save_visit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
