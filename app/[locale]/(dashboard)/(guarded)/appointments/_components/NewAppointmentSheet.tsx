"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Loader2 } from "lucide-react";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { Doctor, AppointmentTypeOption, AppointmentConflict, NewAppointmentForm } from "../types";

const EMPTY_FORM: NewAppointmentForm = {
  patientId: "",
  doctorId: "",
  appointmentTypeCode: "",
  scheduledAt: "",
  durationMinutes: "30",
  reasonForVisit: "",
  notes: "",
  recurrenceFrequency: "",
  recurrenceOccurrences: "4",
};

export function NewAppointmentSheet({
  open,
  onOpenChange,
  doctors,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  onCreated: () => void;
}) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");

  const [form, setForm] = useState<NewAppointmentForm>(EMPTY_FORM);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<AppointmentConflict[] | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/v1/settings/reference-data/appointment_type")
      .then((res) => res.json())
      .then((data) => setAppointmentTypes(Array.isArray(data) ? data : []))
      .catch(() => setAppointmentTypes([]));
  }, [open]);

  const update = <K extends keyof NewAppointmentForm>(key: K, value: NewAppointmentForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setConflicts(null);
  };

  const submit = async (force = false) => {
    setIsSaving(true);
    setError(null);
    if (!force) setConflicts(null);
    try {
      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          doctorId: form.doctorId,
          appointmentTypeCode: form.appointmentTypeCode || undefined,
          scheduledAt: form.scheduledAt,
          durationMinutes: form.durationMinutes,
          reasonForVisit: form.reasonForVisit || undefined,
          notes: form.notes || undefined,
          force,
          recurrence: form.recurrenceFrequency
            ? { frequency: form.recurrenceFrequency, occurrences: Number(form.recurrenceOccurrences) }
            : undefined,
        }),
      });

      if (res.status === 409) {
        const payload = await res.json();
        setConflicts(payload.skipped?.[0]?.conflicts ?? payload.conflicts ?? []);
        return;
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("booking_error"));
        return;
      }

      onCreated();
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(t("booking_error"));
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
          <SheetTitle>{t("new_appointment")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="space-y-2">
            <Label>{tc("patient")}</Label>
            <PatientSearchAutocomplete onSelect={(p) => update("patientId", p?.id ?? "")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("doctor")}</Label>
              <select
                required
                value={form.doctorId}
                onChange={(e) => update("doctorId", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t("select_doctor")}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}{d.specialty ? ` (${d.specialty})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("appointment_type")}</Label>
              <select
                value={form.appointmentTypeCode}
                onChange={(e) => update("appointmentTypeCode", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t("select_type")}</option>
                {appointmentTypes.map((type) => (
                  <option key={type.id} value={type.code}>
                    {type.nameFr}
                  </option>
                ))}
              </select>
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
              <Label>{t("duration_minutes")}</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={form.durationMinutes}
                onChange={(e) => update("durationMinutes", e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>{t("reason_for_visit")}</Label>
              <Input
                value={form.reasonForVisit}
                onChange={(e) => update("reasonForVisit", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("repeat")}</Label>
              <select
                value={form.recurrenceFrequency}
                onChange={(e) => update("recurrenceFrequency", e.target.value as NewAppointmentForm["recurrenceFrequency"])}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t("repeat_none")}</option>
                <option value="weekly">{t("repeat_weekly")}</option>
                <option value="monthly">{t("repeat_monthly")}</option>
              </select>
            </div>
            {form.recurrenceFrequency && (
              <div className="space-y-2">
                <Label>{t("occurrences")}</Label>
                <Input
                  type="number"
                  min={2}
                  max={52}
                  value={form.recurrenceOccurrences}
                  onChange={(e) => update("recurrenceOccurrences", e.target.value)}
                />
              </div>
            )}
          </div>

          {conflicts && conflicts.length > 0 && (
            <div className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded p-3 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> {t("scheduling_conflict")}
              </div>
              <ul className="space-y-1 list-disc list-inside">
                {conflicts.map((c, idx) => (
                  <li key={c.appointmentId ?? idx}>
                    {c.reason ?? `${c.patientName} — ${c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : ""}`}
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
                {t("book_anyway")}
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("new_appointment")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
