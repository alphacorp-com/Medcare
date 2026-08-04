"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { LAB_PANELS, CUSTOM_PANEL_CODE } from "@/lib/laboratory/panels";
import { ActiveStay, ExamUrgency, NewExamForm } from "../types";

const EMPTY_FORM: NewExamForm = {
  patientId: "",
  stayId: "",
  panelCode: LAB_PANELS[0].code,
  examLabel: "",
  urgency: "routine",
  notes: "",
};

export function PrescribeExamSheet({
  open,
  onOpenChange,
  onPrescribed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrescribed: () => void;
}) {
  const t = useTranslations("lab");
  const tc = useTranslations("common");

  const [form, setForm] = useState<NewExamForm>(EMPTY_FORM);
  const [activeStays, setActiveStays] = useState<ActiveStay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof NewExamForm>(key: K, value: NewExamForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setActiveStays([]);
    setError(null);
  };

  const handlePatientSelect = async (patient: { id: string } | null) => {
    update("patientId", patient?.id ?? "");
    update("stayId", "");
    setActiveStays([]);
    if (!patient) return;
    try {
      const res = await fetch(`/api/v1/patients/${patient.id}/stays?status=in_progress`);
      const json = await res.json();
      if (json.success) setActiveStays(json.data);
    } catch (err) {
      console.error("Failed to fetch active stays", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.patientId) {
      setError(t("patient_required"));
      return;
    }
    if (form.panelCode === CUSTOM_PANEL_CODE && !form.examLabel.trim()) {
      setError(t("exam_label_required"));
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/laboratory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          stayId: form.stayId || undefined,
          panelCode: form.panelCode,
          examLabel: form.panelCode === CUSTOM_PANEL_CODE ? form.examLabel : undefined,
          urgency: form.urgency,
          notes: form.notes || undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("prescribe_error"));
        return;
      }

      onPrescribed();
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(t("prescribe_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("prescribe_exam")}</SheetTitle>
          <SheetDescription className="text-xs">{t("prescribe_exam_desc")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                {t("patient_search")}
              </label>
              <PatientSearchAutocomplete className="h-9 text-xs" onSelect={handlePatientSelect} />
            </div>

            {activeStays.length > 0 && (
              <div>
                <Label>{t("link_to_stay")}</Label>
                <select
                  value={form.stayId}
                  onChange={(e) => update("stayId", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 mt-1"
                >
                  <option value="">{t("no_stay_linked")}</option>
                  {activeStays.map((s) => (
                    <option key={s.id} value={s.id}>{s.stayNumber}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                {t("panel_type")}
              </label>
              <select
                value={form.panelCode}
                onChange={(e) => update("panelCode", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                {LAB_PANELS.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
                <option value={CUSTOM_PANEL_CODE}>{t("custom_panel")}</option>
              </select>
            </div>

            {form.panelCode === CUSTOM_PANEL_CODE && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                  {t("custom_panel_label")}
                </label>
                <input
                  value={form.examLabel}
                  onChange={(e) => update("examLabel", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                {t("priority")}
              </label>
              <div className="flex gap-2">
                {(["routine", "urgent", "stat"] as ExamUrgency[]).map((level) => (
                  <label
                    key={level}
                    className={`flex-1 border rounded p-2 text-center cursor-pointer flex flex-col items-center gap-1 bg-white shadow-sm ${
                      form.urgency === level ? "border-blue-400 ring-1 ring-blue-300" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="urgency"
                      className="hidden"
                      checked={form.urgency === level}
                      onChange={() => update("urgency", level)}
                    />
                    <span className={`text-[11px] font-bold uppercase ${
                      level === "stat" ? "text-red-600" : level === "urgent" ? "text-orange-600" : "text-slate-700"
                    }`}>
                      {t(level)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                {t("clinical_notes")}
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 min-h-[80px]"
                placeholder={t("clinical_notes_placeholder")}
              />
            </div>
          </div>

          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              {t("prescribe")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
