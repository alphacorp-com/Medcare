"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { NewPregnancyForm } from "../types";

const EMPTY_FORM: NewPregnancyForm = {
  patientId: "",
  lastMenstrualPeriod: "",
  gravida: "1",
  para: "0",
  riskFactors: "",
  notes: "",
};

export function NewPregnancySheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");

  const [form, setForm] = useState<NewPregnancyForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof NewPregnancyForm>(key: K, value: NewPregnancyForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.patientId || !form.lastMenstrualPeriod) {
      setError(t("patient_and_lmp_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/maternity/pregnancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          lastMenstrualPeriod: form.lastMenstrualPeriod,
          gravida: Number(form.gravida),
          para: Number(form.para),
          riskFactors: form.riskFactors
            ? form.riskFactors.split(",").map((r) => r.trim()).filter(Boolean)
            : [],
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("create_error"));
        return;
      }
      onCreated();
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(t("create_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("new_pregnancy")}</SheetTitle>
          <SheetDescription className="text-xs">{t("new_pregnancy_desc")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
            )}

            <div className="space-y-1">
              <Label>{t("patient")}</Label>
              <PatientSearchAutocomplete
                className="h-9 text-xs"
                onSelect={(patient) => update("patientId", patient?.id ?? "")}
              />
            </div>

            <div className="space-y-1">
              <Label>{t("last_menstrual_period")}</Label>
              <Input
                type="date"
                value={form.lastMenstrualPeriod}
                onChange={(e) => update("lastMenstrualPeriod", e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("gravida")}</Label>
                <Input type="number" min="1" value={form.gravida} onChange={(e) => update("gravida", e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <Label>{t("para")}</Label>
                <Input type="number" min="0" value={form.para} onChange={(e) => update("para", e.target.value)} className="h-9 text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("risk_factors")}</Label>
              <Input
                value={form.riskFactors}
                onChange={(e) => update("riskFactors", e.target.value)}
                placeholder={t("risk_factors_placeholder")}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label>{t("notes")}</Label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              />
            </div>
          </div>

          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving} size="sm" className="bg-pink-600 hover:bg-pink-700 text-white text-xs h-8">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              {t("register_pregnancy")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
