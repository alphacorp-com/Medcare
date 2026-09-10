"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Loader2 } from "lucide-react";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { ActiveStay, Doctor, NewSurgeryForm, SurgeryConflict } from "../types";

const EMPTY_FORM: NewSurgeryForm = {
  patientId: "",
  stayId: "",
  surgeonId: "",
  anesthesiologistId: "",
  procedureLabel: "",
  procedureCode: "",
  roomId: "",
  scheduledAt: "",
  asaScore: "",
};

export function ScheduleSurgerySheet({
  open,
  onOpenChange,
  doctors,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  onScheduled: () => void;
}) {
  const t = useTranslations("surgery");
  const tc = useTranslations("common");

  const [form, setForm] = useState<NewSurgeryForm>(EMPTY_FORM);
  const [activeStays, setActiveStays] = useState<ActiveStay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SurgeryConflict[] | null>(null);

  const update = <K extends keyof NewSurgeryForm>(key: K, value: NewSurgeryForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setActiveStays([]);
    setError(null);
    setConflicts(null);
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

  const submit = async (force = false) => {
    setIsSaving(true);
    setError(null);
    if (!force) setConflicts(null);
    try {
      const res = await fetch("/api/v1/surgeries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          stayId: form.stayId || undefined,
          surgeonId: form.surgeonId,
          anesthesiologistId: form.anesthesiologistId || undefined,
          procedureLabel: form.procedureLabel,
          procedureCode: form.procedureCode || undefined,
          roomId: form.roomId || undefined,
          scheduledAt: form.scheduledAt,
          asaScore: form.asaScore || undefined,
          force,
        }),
      });

      if (res.status === 409) {
        const payload = await res.json();
        setConflicts(payload.conflicts ?? []);
        return;
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("schedule_error"));
        return;
      }

      onScheduled();
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(t("schedule_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.patientId) {
      setError(t("patient_required"));
      return;
    }
    submit(false);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("schedule_intervention")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="space-y-2">
            <Label>{tc("patient")}</Label>
            <PatientSearchAutocomplete onSelect={handlePatientSelect} />
          </div>

          {activeStays.length > 0 && (
            <div className="space-y-2">
              <Label>{t("link_to_stay")}</Label>
              <select
                value={form.stayId}
                onChange={(e) => update("stayId", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t("no_stay_linked")}</option>
                {activeStays.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stayNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("surgeon")}</Label>
              <select
                required
                value={form.surgeonId}
                onChange={(e) => update("surgeonId", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t("select_surgeon")}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}{d.specialty ? ` (${d.specialty})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("anesthesiologist")}</Label>
              <select
                value={form.anesthesiologistId}
                onChange={(e) => update("anesthesiologistId", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t("unassigned")}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}{d.specialty ? ` (${d.specialty})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>{t("procedure_type")}</Label>
              <Input
                required
                value={form.procedureLabel}
                onChange={(e) => update("procedureLabel", e.target.value)}
                placeholder="Appendectomy"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("procedure_code")}</Label>
              <Input
                value={form.procedureCode}
                onChange={(e) => update("procedureCode", e.target.value)}
                placeholder="CCAM"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("room")}</Label>
              <Input
                value={form.roomId}
                onChange={(e) => update("roomId", e.target.value)}
                placeholder="OR-1"
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("date")} & {tc("time")}</Label>
              <Input
                type="datetime-local"
                required
                value={form.scheduledAt}
                onChange={(e) => update("scheduledAt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("asa_score")}</Label>
              <select
                value={form.asaScore}
                onChange={(e) => update("asaScore", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">-</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>ASA {n}</option>
                ))}
              </select>
            </div>
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-800 hover:bg-orange-100"
                disabled={isSaving}
                onClick={() => submit(true)}
              >
                {t("schedule_anyway")}
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("schedule_intervention")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
