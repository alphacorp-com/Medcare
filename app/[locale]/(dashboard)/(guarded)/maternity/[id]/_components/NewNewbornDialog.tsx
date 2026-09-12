"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Gender } from "../../types";

export function NewNewbornDialog({
  open,
  onOpenChange,
  deliveryId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string;
  onSaved: () => void;
}) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");

  const [firstName, setFirstName] = useState("");
  const [sex, setSex] = useState<Gender>("M");
  const [birthWeightGrams, setBirthWeightGrams] = useState("");
  const [apgarScore1Min, setApgarScore1Min] = useState("");
  const [apgarScore5Min, setApgarScore5Min] = useState("");
  const [vitaminKGiven, setVitaminKGiven] = useState(false);
  const [resuscitationNeeded, setResuscitationNeeded] = useState(false);
  const [outcome, setOutcome] = useState("alive");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/maternity/deliveries/${deliveryId}/newborns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName || undefined,
          sex,
          birthWeightGrams: birthWeightGrams || undefined,
          apgarScore1Min: apgarScore1Min || undefined,
          apgarScore5Min: apgarScore5Min || undefined,
          vitaminKGiven,
          resuscitationNeeded,
          outcome,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("newborn_save_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("newborn_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("register_newborn")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
          <p className="text-xs text-slate-500">{t("register_newborn_desc")}</p>

          <div className="space-y-1">
            <Label>{t("newborn_first_name")}</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("newborn_first_name_placeholder")} className="h-9 text-xs" />
          </div>

          <div className="space-y-1">
            <Label>{t("sex")}</Label>
            <div className="flex gap-2">
              {(["M", "F"] as Gender[]).map((s) => (
                <label
                  key={s}
                  className={`flex-1 border rounded p-2 text-center cursor-pointer text-xs font-bold uppercase ${
                    sex === s ? "border-pink-400 ring-1 ring-pink-300 bg-pink-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <input type="radio" name="sex" className="hidden" checked={sex === s} onChange={() => setSex(s)} />
                  {t(s === "M" ? "sex_male" : "sex_female")}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder={t("birth_weight_g")} value={birthWeightGrams} onChange={(e) => setBirthWeightGrams(e.target.value)} className="h-9 text-xs" />
            <Input type="number" placeholder={t("apgar_1min")} value={apgarScore1Min} onChange={(e) => setApgarScore1Min(e.target.value)} className="h-9 text-xs" />
            <Input type="number" placeholder={t("apgar_5min")} value={apgarScore5Min} onChange={(e) => setApgarScore5Min(e.target.value)} className="h-9 text-xs" />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={vitaminKGiven} onChange={(e) => setVitaminKGiven(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t("vitamin_k_given")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={resuscitationNeeded} onChange={(e) => setResuscitationNeeded(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t("resuscitation_needed")}
          </label>

          <div className="space-y-1">
            <Label>{t("newborn_outcome")}</Label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            >
              <option value="alive">{t("outcome_alive")}</option>
              <option value="stillbirth">{t("outcome_stillbirth")}</option>
              <option value="neonatal_death">{t("outcome_neonatal_death")}</option>
            </select>
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
            {t("register_newborn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
