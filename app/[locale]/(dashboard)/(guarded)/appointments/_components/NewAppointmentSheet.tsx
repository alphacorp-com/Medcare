"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addMonths, addWeeks, format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, CalendarDays, ClipboardList, Loader2, Repeat, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { cn } from "@/lib/utils";
import { Doctor, AppointmentTypeOption, AppointmentConflict, NewAppointmentForm } from "../types";

const DURATION_PRESETS = [15, 30, 45, 60];
const RECURRENCE_PREVIEW_LIMIT = 6;

const emptyForm = (): NewAppointmentForm => ({
  patientId: "",
  doctorId: "",
  appointmentTypeCode: "",
  date: format(new Date(), "yyyy-MM-dd"),
  time: "",
  durationMinutes: "30",
  reasonForVisit: "",
  notes: "",
  recurrenceFrequency: "",
  recurrenceOccurrences: "4",
});

interface Slot {
  time: string; // ISO
  busy: boolean;
}

// One availability answer, tagged with the doctor/date it was fetched for. Loading is
// derived by comparing that tag with the current selection (no setState inside the effect).
interface AvailabilityState {
  key: string;
  slots: Slot[];
  configured: boolean;
  fetchedAt: number;
}

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400";

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        <Icon className="h-4 w-4 text-blue-600" /> {title}
      </h3>
      {children}
    </section>
  );
}

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
  const locale = useLocale();

  const [form, setForm] = useState<NewAppointmentForm>(emptyForm);
  const [patientKey, setPatientKey] = useState(0); // remounts the patient search on reset
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeOption[]>([]);
  const [availability, setAvailability] = useState<AvailabilityState | null>(null);
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

  // Free/busy slots of the selected doctor on the selected day.
  const availabilityKey = open && form.doctorId && form.date ? `${form.doctorId}|${form.date}` : null;
  useEffect(() => {
    if (!availabilityKey) return;
    const [doctorId, date] = availabilityKey.split("|");
    const controller = new AbortController();
    fetch(`/api/v1/appointments/availability?${new URLSearchParams({ doctorId, date })}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) =>
        setAvailability({
          key: availabilityKey,
          slots: Array.isArray(json.data) ? json.data : [],
          configured: Boolean(json.hasConfiguredAvailability),
          fetchedAt: Date.now(),
        })
      )
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[appointments availability]", err);
        // Without slots, the form falls back to the free time input.
        setAvailability({ key: availabilityKey, slots: [], configured: false, fetchedAt: Date.now() });
      });
    return () => controller.abort();
  }, [availabilityKey]);

  const currentAvailability = availability && availability.key === availabilityKey ? availability : null;
  const isLoadingSlots = Boolean(availabilityKey) && !currentAvailability;

  const update = <K extends keyof NewAppointmentForm>(key: K, value: NewAppointmentForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(emptyForm());
    setPatientKey((k) => k + 1);
    setError(null);
    setConflicts(null);
  };

  const slotLabel = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const slotValue = (iso: string) => format(new Date(iso), "HH:mm");

  // The appointment start in the browser's timezone, sent as an absolute ISO instant.
  const scheduledAt = useMemo(() => {
    if (!form.date || !form.time) return null;
    const date = new Date(`${form.date}T${form.time}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [form.date, form.time]);

  const recurrenceDates = useMemo(() => {
    if (!scheduledAt || !form.recurrenceFrequency) return [];
    const count = Math.min(Math.max(Number(form.recurrenceOccurrences) || 0, 2), 52);
    const step = form.recurrenceFrequency === "monthly" ? addMonths : addWeeks;
    return Array.from({ length: count }, (_, i) => step(scheduledAt, i));
  }, [scheduledAt, form.recurrenceFrequency, form.recurrenceOccurrences]);

  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);

  const submit = async (force = false) => {
    if (!scheduledAt) return;
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
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: form.durationMinutes,
          reasonForVisit: form.reasonForVisit.trim() || undefined,
          notes: form.notes.trim() || undefined,
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

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || t("booking_error"));
        return;
      }

      // A series books what it can and reports the occurrences it had to skip.
      const created = Array.isArray(payload.data) ? payload.data.length : 1;
      const skipped = Array.isArray(payload.skipped) ? payload.skipped.length : 0;
      if (skipped > 0) toast.warning(t("series_partial", { created, skipped }));

      onCreated();
      onOpenChange(false);
      reset();
    } catch {
      setError(t("booking_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.patientId) return setError(t("patient_required"));
    if (!form.doctorId) return setError(t("doctor_required"));
    if (!scheduledAt) return setError(t("slot_required"));
    submit(false);
  };

  const showManualTime = !currentAvailability?.configured || !currentAvailability.slots.length;

  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <SheetContent className="sm:max-w-2xl p-0 flex flex-col gap-0">
        <SheetHeader className="px-6 py-4 border-b border-slate-100">
          <SheetTitle>{t("new_appointment")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4 sm:px-6 space-y-4">
            {error && (
              <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
            )}

            <Section icon={User} title={t("section_patient")}>
              <PatientSearchAutocomplete key={patientKey} onSelect={(p) => update("patientId", p?.id ?? "")} />
            </Section>

            <Section icon={Stethoscope} title={t("section_doctor")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="appt-doctor">{t("doctor")}</Label>
                  <select
                    id="appt-doctor"
                    value={form.doctorId}
                    onChange={(e) => setForm((prev) => ({ ...prev, doctorId: e.target.value, time: "" }))}
                    className={SELECT_CLASS}
                  >
                    <option value="">{t("select_doctor")}</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}{d.specialty ? ` (${d.specialty})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="appt-type">{t("appointment_type")}</Label>
                  <select
                    id="appt-type"
                    value={form.appointmentTypeCode}
                    onChange={(e) => update("appointmentTypeCode", e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">{t("select_type")}</option>
                    {appointmentTypes.map((type) => (
                      <option key={type.id} value={type.code}>
                        {locale === "en" && type.nameEn ? type.nameEn : type.nameFr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            <Section icon={CalendarClock} title={t("section_slot")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="appt-date">{tc("date")}</Label>
                  <Input
                    id="appt-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value, time: "" }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("duration_minutes")}</Label>
                  <div className="flex items-center gap-1.5">
                    {DURATION_PRESETS.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        aria-pressed={form.durationMinutes === String(minutes)}
                        onClick={() => update("durationMinutes", String(minutes))}
                        className={cn(
                          "h-9 rounded-md border px-2.5 text-xs font-medium",
                          form.durationMinutes === String(minutes)
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                        )}
                      >
                        {minutes}
                      </button>
                    ))}
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      aria-label={t("duration_minutes")}
                      value={form.durationMinutes}
                      onChange={(e) => update("durationMinutes", e.target.value)}
                      className="h-9 w-20"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("available_slots")}</Label>
                {!form.doctorId ? (
                  <p className="text-xs text-slate-500">{t("select_doctor_date_first")}</p>
                ) : isLoadingSlots ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("loading_slots")}
                  </p>
                ) : !currentAvailability?.configured ? (
                  <p className="text-xs text-slate-500">{t("no_availability_configured")}</p>
                ) : currentAvailability.slots.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("no_slots")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {currentAvailability.slots.map((slot) => {
                      const value = slotValue(slot.time);
                      const isPast = new Date(slot.time).getTime() < currentAvailability.fetchedAt;
                      const isSelected = form.time === value;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={slot.busy || isPast}
                          aria-pressed={isSelected}
                          title={slot.busy ? t("slot_busy") : undefined}
                          onClick={() => update("time", value)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                            "disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300",
                            slot.busy && "line-through",
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
                          )}
                        >
                          {slotLabel(slot.time)}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className={cn("flex items-center gap-2", !showManualTime && "pt-1")}>
                  <Label htmlFor="appt-time" className="text-xs font-normal text-slate-500 shrink-0">
                    {showManualTime ? tc("time") : t("other_time")}
                  </Label>
                  <Input
                    id="appt-time"
                    type="time"
                    step={300}
                    value={form.time}
                    onChange={(e) => update("time", e.target.value)}
                    className="h-8 w-32"
                  />
                </div>
              </div>
            </Section>

            <Section icon={ClipboardList} title={t("section_details")}>
              <div className="space-y-1.5">
                <Label htmlFor="appt-reason">{t("reason_for_visit")}</Label>
                <Input
                  id="appt-reason"
                  value={form.reasonForVisit}
                  maxLength={255}
                  placeholder={t("reason_placeholder")}
                  onChange={(e) => update("reasonForVisit", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-notes">{t("notes")}</Label>
                <textarea
                  id="appt-notes"
                  rows={3}
                  maxLength={1000}
                  value={form.notes}
                  placeholder={t("notes_placeholder")}
                  onChange={(e) => update("notes", e.target.value)}
                  className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </Section>

            <Section icon={Repeat} title={t("section_recurrence")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="appt-repeat">{t("repeat")}</Label>
                  <select
                    id="appt-repeat"
                    value={form.recurrenceFrequency}
                    onChange={(e) => update("recurrenceFrequency", e.target.value as NewAppointmentForm["recurrenceFrequency"])}
                    className={SELECT_CLASS}
                  >
                    <option value="">{t("repeat_none")}</option>
                    <option value="weekly">{t("repeat_weekly")}</option>
                    <option value="monthly">{t("repeat_monthly")}</option>
                  </select>
                </div>
                {form.recurrenceFrequency && (
                  <div className="space-y-1.5">
                    <Label htmlFor="appt-occurrences">{t("occurrences")}</Label>
                    <Input
                      id="appt-occurrences"
                      type="number"
                      min={2}
                      max={52}
                      value={form.recurrenceOccurrences}
                      onChange={(e) => update("recurrenceOccurrences", e.target.value)}
                    />
                  </div>
                )}
              </div>
              {recurrenceDates.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500">{t("recurrence_preview")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recurrenceDates.slice(0, RECURRENCE_PREVIEW_LIMIT).map((date) => (
                      <span key={date.toISOString()} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    ))}
                    {recurrenceDates.length > RECURRENCE_PREVIEW_LIMIT && (
                      <span className="px-1 py-0.5 text-[11px] text-slate-500">
                        {t("recurrence_more", { count: recurrenceDates.length - RECURRENCE_PREVIEW_LIMIT })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Section>

            {conflicts && conflicts.length > 0 && (
              <div role="alert" className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> {t("scheduling_conflict")}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  {conflicts.map((c, idx) => (
                    <li key={c.appointmentId ?? idx}>
                      {c.reason ?? `${c.patientName} — ${c.scheduledAt ? new Date(c.scheduledAt).toLocaleString(locale) : ""}`}
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
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
              <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="truncate">
                {scheduledAt && selectedDoctor
                  ? t("summary", {
                      date: scheduledAt.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }),
                      time: scheduledAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
                      duration: form.durationMinutes,
                      doctor: selectedDoctor.fullName,
                    })
                  : t("summary_empty")}
              </span>
            </p>
            <div className="flex justify-end gap-3 shrink-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
              <Button type="submit" disabled={isSaving} className="bg-blue-600 text-white hover:bg-blue-700">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("book")}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
