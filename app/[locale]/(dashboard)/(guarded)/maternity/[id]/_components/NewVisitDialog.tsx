"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { notifyBillingGenerated } from "@/lib/billing/client";
import { apiFetch } from "@/lib/api-client";
import { useMaternityError } from "@/components/maternity/use-maternity-error";

type TdLot = { id: string; itemName: string; lotNumber: string; expiryDate: string | null };
type TdInfo = { lastDose: { doseNumber: number; administeredAt: string } | null; managed: boolean; lots: TdLot[] };

const selectClass = "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400";

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
  const format = useFormatter();
  const errorMessage = useMaternityError();

  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(String(suggestedGestationalAge));
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState("");
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState("");
  const [weight, setWeight] = useState("");
  const [fundalHeightCm, setFundalHeightCm] = useState("");
  const [fetalHeartRate, setFetalHeartRate] = useState("");
  const [ironFolateGiven, setIronFolateGiven] = useState(false);
  const [strategy, setStrategy] = useState<"fixed" | "outreach">("fixed");
  const [hemoglobin, setHemoglobin] = useState("");
  // Td: recorded as a dose of the vaccination register (rank 1-5, lot).
  const [tdGiven, setTdGiven] = useState(false);
  const [tdDose, setTdDose] = useState("");
  const [tdLotId, setTdLotId] = useState("");
  const [tdLotNumber, setTdLotNumber] = useState("");
  const [malariaPreventionGiven, setMalariaPreventionGiven] = useState(false);
  const [itnGiven, setItnGiven] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tdQuery = useQuery({
    queryKey: ["maternity", "td", pregnancyId],
    queryFn: () => apiFetch<{ data: TdInfo }>(`/api/v1/maternity/pregnancies/${pregnancyId}/td`),
    enabled: open && tdGiven,
  });
  const td = tdQuery.data?.data;
  // The next rank after the last recorded dose (at most 5).
  const suggestedDose = String(Math.min(5, (td?.lastDose?.doseNumber ?? 0) + 1));
  const doseValue = tdDose || suggestedDose;

  const handleSave = async () => {
    if (!gestationalAgeWeeks) {
      setError(t("gestational_age_required"));
      return;
    }
    if (tdGiven && td?.managed && !tdLotId) {
      setError(t("errors.stock_lot_required"));
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
          malariaPreventionGiven,
          itnGiven,
          notes: notes || undefined,
          strategy,
          hemoglobinGPerDl: hemoglobin || undefined,
          td: tdGiven ? { doseNumber: Number(doseValue), stockLotId: tdLotId || undefined, lotNumber: td?.managed ? undefined : tdLotNumber || undefined } : undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(payload, payload?.error || t("visit_save_error")));
        return;
      }
      notifyBillingGenerated(payload?.billing, tc("invoice_generated"));
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
            <Input type="number" placeholder={t("fetal_heart_rate")} value={fetalHeartRate} onChange={(e) => setFetalHeartRate(e.target.value)} className="h-9 text-xs" />
            <Input type="number" step="0.1" min={2} max={25} placeholder={t("hemoglobin_g_dl")} value={hemoglobin} onChange={(e) => setHemoglobin(e.target.value)} className="h-9 text-xs" />
          </div>

          <div className="space-y-1">
            <Label>{t("visit_strategy")}</Label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as "fixed" | "outreach")} className={selectClass}>
              <option value="fixed">{t("strategy_fixed")}</option>
              <option value="outreach">{t("strategy_outreach")}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={ironFolateGiven} onChange={(e) => setIronFolateGiven(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("iron_folate_given")}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={tdGiven} onChange={(e) => setTdGiven(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("tetanus_vaccine_given")}
            </label>
            {tdGiven && (
              <div className="ml-6 space-y-2 rounded border border-pink-100 bg-pink-50/40 p-2">
                {tdQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  <>
                    <p className="text-[11px] text-slate-500">
                      {td?.lastDose
                        ? t("td_last_dose", { dose: td.lastDose.doseNumber, date: format.dateTime(new Date(td.lastDose.administeredAt), { dateStyle: "medium" }) })
                        : t("td_no_previous_dose")}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase text-slate-500">{t("td_dose")}</span>
                        <select value={doseValue} onChange={(e) => setTdDose(e.target.value)} className={selectClass}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{t("td_dose_n", { n })}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase text-slate-500">{t("td_lot")}</span>
                        {td?.managed ? (
                          <select value={tdLotId} onChange={(e) => setTdLotId(e.target.value)} className={selectClass}>
                            <option value="">{tc("select_placeholder")}</option>
                            {td.lots.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.lotNumber} — {lot.itemName}
                                {lot.expiryDate ? ` · ${format.dateTime(new Date(lot.expiryDate), { dateStyle: "short", timeZone: "UTC" })}` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input value={tdLotNumber} maxLength={60} onChange={(e) => setTdLotNumber(e.target.value)} className="h-9 text-xs" />
                        )}
                      </label>
                    </div>
                    {td?.managed && td.lots.length === 0 && <p className="text-[11px] text-red-700">{t("td_no_lot")}</p>}
                    <p className="text-[10px] text-slate-400">{t("td_register_hint")}</p>
                  </>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={malariaPreventionGiven} onChange={(e) => setMalariaPreventionGiven(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("malaria_prevention_given")}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={itnGiven} onChange={(e) => setItnGiven(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("itn_given")}
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
