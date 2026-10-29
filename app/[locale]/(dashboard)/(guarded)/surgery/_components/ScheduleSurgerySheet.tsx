"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { AlertTriangle, CalendarClock, Loader2, Plus, Scissors, Siren, Trash2, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { cn } from "@/lib/utils";
import { TEAM_ROLES, type TeamRole } from "@/lib/surgery/validation";
import { ActiveStay, Doctor, NewSurgeryForm, OperatingRoom, SurgeryConflict } from "../types";
import { FieldLabel, SheetError, SheetSection, SurgerySheet, surgerySelectClass } from "./SurgerySheetLayout";

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
  expectedDurationMinutes: "90",
  isEmergency: false,
  team: [],
};

const DURATION_PRESETS = [30, 60, 90, 120, 180, 240];
const ASA_SCORES = ["1", "2", "3", "4", "5", "6"];

export function ScheduleSurgerySheet({
  open,
  onOpenChange,
  doctors,
  staff,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  // Every active account, for the operating team (nurses are not "doctors").
  staff: Doctor[];
  onScheduled: () => void;
}) {
  const t = useTranslations("surgery");
  const tc = useTranslations("common");

  const [form, setForm] = useState<NewSurgeryForm>(EMPTY_FORM);
  const [activeStays, setActiveStays] = useState<ActiveStay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SurgeryConflict[] | null>(null);
  const [rooms, setRooms] = useState<OperatingRoom[]>([]);

  // The facility's operating rooms (beds of room type "Chirurgie"), loaded when the sheet opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/surgeries/rooms");
        const json = await res.json();
        if (!cancelled && res.ok) setRooms(json.data ?? []);
      } catch (err) {
        console.error("Failed to fetch operating rooms", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const update = <K extends keyof NewSurgeryForm>(key: K, value: NewSurgeryForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setActiveStays([]);
    setError(null);
    setConflicts(null);
  };

  const handlePatientSelect = async (patient: { id: string } | null) => {
    setForm((prev) => ({ ...prev, patientId: patient?.id ?? "", stayId: "" }));
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

  const setTeamMember = (index: number, patch: Partial<NewSurgeryForm["team"][number]>) =>
    setForm((prev) => ({ ...prev, team: prev.team.map((m, i) => (i === index ? { ...m, ...patch } : m)) }));

  const submit = async (force = false) => {
    if (!form.patientId) return setError(t("patient_required"));
    if (form.team.some((m) => !m.userId)) return setError(t("team_member_required"));
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
          expectedDurationMinutes: form.expectedDurationMinutes || undefined,
          isEmergency: form.isEmergency,
          team: form.team,
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
    } catch {
      setError(t("schedule_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const doctorOptions = doctors.map((d) => (
    <option key={d.id} value={d.id}>
      {d.fullName}
      {d.specialty ? ` (${d.specialty})` : ""}
    </option>
  ));

  return (
    <SurgerySheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title={t("schedule_intervention")}
      description={t("schedule_intervention_desc")}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="schedule-surgery-form" disabled={isSaving} className="bg-blue-600 text-white hover:bg-blue-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}
            {t("schedule_intervention")}
          </Button>
        </>
      }
    >
      <form
        id="schedule-surgery-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <SheetError message={error} />

        {conflicts && conflicts.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" /> {t("scheduling_conflict")}
            </div>
            <ul className="space-y-1 text-xs text-amber-800">
              {conflicts.map((c) => (
                <li key={`${c.resource}-${c.procedureId}`}>
                  <span className="font-semibold">{c.resource === "surgeon" ? t("conflict_surgeon") : t("conflict_room")}</span> — {c.procedureLabel} ·{" "}
                  {c.patientName} · {format(new Date(c.scheduledAt), "dd/MM HH:mm")}
                </li>
              ))}
            </ul>
            <Button type="button" size="sm" variant="outline" className="h-8 border-amber-300 text-amber-800" disabled={isSaving} onClick={() => submit(true)}>
              {t("schedule_anyway")}
            </Button>
          </div>
        )}

        <SheetSection icon={User} title={tc("patient")}>
          <PatientSearchAutocomplete onSelect={handlePatientSelect} />
          {activeStays.length > 0 && (
            <div>
              <FieldLabel>{t("link_to_stay")}</FieldLabel>
              <select value={form.stayId} onChange={(e) => update("stayId", e.target.value)} className={surgerySelectClass}>
                <option value="">{t("no_stay_linked")}</option>
                {activeStays.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stayNumber}
                  </option>
                ))}
              </select>
            </div>
          )}
        </SheetSection>

        <SheetSection icon={Scissors} title={t("intervention")}>
          <div>
            <FieldLabel required>{t("procedure_type")}</FieldLabel>
            <Input required value={form.procedureLabel} onChange={(e) => update("procedureLabel", e.target.value)} placeholder={t("procedure_placeholder")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>{t("procedure_code")}</FieldLabel>
              <Input value={form.procedureCode} onChange={(e) => update("procedureCode", e.target.value)} placeholder="CCAM" className="font-mono" />
            </div>
            <div>
              <FieldLabel>{t("asa_score")}</FieldLabel>
              <div className="flex gap-1" role="radiogroup" aria-label={t("asa_score")}>
                {ASA_SCORES.map((score) => (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={form.asaScore === score}
                    onClick={() => update("asaScore", form.asaScore === score ? "" : score)}
                    className={cn(
                      "h-9 flex-1 rounded-md border text-xs font-semibold transition-colors",
                      form.asaScore === score ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              form.isEmergency ? "border-red-300 bg-red-50" : "border-slate-200 hover:bg-slate-50"
            )}
          >
            <input type="checkbox" checked={form.isEmergency} onChange={(e) => update("isEmergency", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>
              <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                <Siren className="h-4 w-4 text-red-600" /> {t("emergency")}
              </span>
              <span className="block text-[11px] text-slate-500">{t("emergency_hint")}</span>
            </span>
          </label>
        </SheetSection>

        <SheetSection icon={CalendarClock} title={t("planning")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel required>
                {tc("date")} & {tc("time")}
              </FieldLabel>
              <Input type="datetime-local" required value={form.scheduledAt} onChange={(e) => update("scheduledAt", e.target.value)} />
            </div>
            <div>
              <FieldLabel>{t("room")}</FieldLabel>
              <select value={form.roomId} onChange={(e) => update("roomId", e.target.value)} className={surgerySelectClass}>
                <option value="">{t("no_room")}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} · {r.label}
                  </option>
                ))}
              </select>
              {rooms.length === 0 && <p className="mt-1 text-[11px] text-slate-500">{t("no_operating_room_hint")}</p>}
            </div>
          </div>
          <div>
            <FieldLabel>{t("expected_duration")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => update("expectedDurationMinutes", String(minutes))}
                  className={cn(
                    "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                    form.expectedDurationMinutes === String(minutes) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                </button>
              ))}
              <Input
                type="number"
                min={5}
                max={1440}
                value={form.expectedDurationMinutes}
                onChange={(e) => update("expectedDurationMinutes", e.target.value)}
                className="h-8 w-24 text-xs"
                aria-label={t("expected_duration")}
              />
              <span className="text-[11px] text-slate-500">min</span>
            </div>
          </div>
        </SheetSection>

        <SheetSection icon={Users} title={t("operating_team")} hint={t("operating_team_hint")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel required>{t("surgeon")}</FieldLabel>
              <select required value={form.surgeonId} onChange={(e) => update("surgeonId", e.target.value)} className={surgerySelectClass}>
                <option value="">{t("select_surgeon")}</option>
                {doctorOptions}
              </select>
            </div>
            <div>
              <FieldLabel>{t("anesthesiologist")}</FieldLabel>
              <select value={form.anesthesiologistId} onChange={(e) => update("anesthesiologistId", e.target.value)} className={surgerySelectClass}>
                <option value="">{t("unassigned")}</option>
                {doctorOptions}
              </select>
            </div>
          </div>
          {form.team.map((member, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <select value={member.role} onChange={(e) => setTeamMember(index, { role: e.target.value as TeamRole })} className={cn(surgerySelectClass, "sm:w-48")}>
                {TEAM_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`team_roles.${role}`)}
                  </option>
                ))}
              </select>
              <select value={member.userId} onChange={(e) => setTeamMember(index, { userId: e.target.value })} className={surgerySelectClass}>
                <option value="">{t("select_member")}</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-red-600 hover:bg-red-50"
                aria-label={tc("delete")}
                onClick={() => setForm((prev) => ({ ...prev, team: prev.team.filter((_, i) => i !== index) }))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setForm((prev) => ({ ...prev, team: [...prev.team, { userId: "", role: "scrub_nurse" }] }))}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> {t("add_team_member")}
          </Button>
        </SheetSection>
      </form>
    </SurgerySheet>
  );
}
