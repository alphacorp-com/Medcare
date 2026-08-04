"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { AlertTriangle, Loader2 } from "lucide-react";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { RADIOLOGY_CATALOG, CUSTOM_EXAM_CODE, findExam } from "@/lib/radiology/catalog";
import { findContrastAllergyMatches } from "@/lib/radiology/contrast";
import { ActiveStay, ExamUrgency, NewExamForm } from "../types";

const EMPTY_FORM: NewExamForm = {
  patientId: "",
  stayId: "",
  examCode: RADIOLOGY_CATALOG[0].code,
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
  const t = useTranslations("radiology");
  const tc = useTranslations("common");

  const [form, setForm] = useState<NewExamForm>(EMPTY_FORM);
  const [activeStays, setActiveStays] = useState<ActiveStay[]>([]);
  const [patientAllergies, setPatientAllergies] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof NewExamForm>(key: K, value: NewExamForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setActiveStays([]);
    setPatientAllergies([]);
    setError(null);
  };

  const selectedExam = findExam(form.examCode);
  const contrastMatches = useMemo(
    () => (selectedExam?.requiresContrast ? findContrastAllergyMatches(patientAllergies) : []),
    [selectedExam, patientAllergies]
  );

  const handlePatientSelect = async (patient: { id: string } | null) => {
    update("patientId", patient?.id ?? "");
    update("stayId", "");
    setActiveStays([]);
    setPatientAllergies([]);
    if (!patient) return;
    try {
      const [staysRes, patientRes] = await Promise.all([
        fetch(`/api/v1/patients/${patient.id}/stays?status=in_progress`),
        fetch(`/api/v1/patients/${patient.id}`),
      ]);
      const staysJson = await staysRes.json();
      if (staysJson.success) setActiveStays(staysJson.data);
      const patientJson = await patientRes.json();
      const allergies = Array.isArray(patientJson?.allergies) ? patientJson.allergies : Array.isArray(patientJson?.data?.allergies) ? patientJson.data.allergies : [];
      setPatientAllergies(allergies);
    } catch (err) {
      console.error("Failed to fetch patient context", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.patientId) {
      setError(t("patient_required"));
      return;
    }
    if (form.examCode === CUSTOM_EXAM_CODE && !form.examLabel.trim()) {
      setError(t("exam_label_required"));
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/radiology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          stayId: form.stayId || undefined,
          examCode: form.examCode,
          examLabel: form.examCode === CUSTOM_EXAM_CODE ? form.examLabel : undefined,
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
          <SheetTitle className="text-lg">{t("new_request")}</SheetTitle>
          <SheetDescription className="text-xs">{t("new_request_desc")}</SheetDescription>
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
                {t("modality")}
              </label>
              <select
                value={form.examCode}
                onChange={(e) => update("examCode", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                {RADIOLOGY_CATALOG.map((exam) => (
                  <option key={exam.code} value={exam.code}>{exam.label}</option>
                ))}
                <option value={CUSTOM_EXAM_CODE}>{t("custom_exam")}</option>
              </select>
            </div>

            {form.examCode === CUSTOM_EXAM_CODE && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                  {t("custom_exam_label")}
                </label>
                <input
                  value={form.examLabel}
                  onChange={(e) => update("examLabel", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                />
              </div>
            )}

            {contrastMatches.length > 0 && (
              <div className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{t("contrast_allergy_warning", { allergies: contrastMatches.join(", ") })}</span>
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
              {t("submit_request")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
