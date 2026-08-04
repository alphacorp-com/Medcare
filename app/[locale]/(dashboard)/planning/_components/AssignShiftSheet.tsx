"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { SHIFT_TYPES } from "@/lib/planning/shifts";
import { NewShiftForm, ScheduleConflict, StaffMember } from "../types";

export function AssignShiftSheet({
  open,
  onOpenChange,
  departmentId,
  staff,
  defaultUserId,
  defaultDate,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  staff: StaffMember[];
  defaultUserId?: string;
  defaultDate?: string;
  onAssigned: () => void;
}) {
  const t = useTranslations("planning");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");

  const [form, setForm] = useState<NewShiftForm>({
    userId: defaultUserId ?? "",
    shiftType: "morning",
    date: defaultDate ?? "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);

  const update = <K extends keyof NewShiftForm>(key: K, value: NewShiftForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (force = false) => {
    setIsSaving(true);
    setError(null);
    if (!force) setConflicts(null);
    try {
      const res = await fetch("/api/v1/planning/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, departmentId, force }),
      });

      if (res.status === 409) {
        const payload = await res.json();
        setConflicts(payload.conflicts ?? []);
        return;
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("assign_error"));
        return;
      }

      onAssigned();
      onOpenChange(false);
    } catch (err) {
      setError(t("assign_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.userId || !form.date) {
      setError(t("staff_and_date_required"));
      return;
    }
    submit(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("assign_shift")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="space-y-1">
            <Label>{t("staff_member")}</Label>
            <select
              value={form.userId}
              onChange={(e) => update("userId", e.target.value)}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            >
              <option value="" disabled>{t("select_staff")}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} ({tr(s.role)})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{tc("date")}</Label>
              <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label>{t("shift_type")}</Label>
              <select
                value={form.shiftType}
                onChange={(e) => update("shiftType", e.target.value as NewShiftForm["shiftType"])}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                {SHIFT_TYPES.map((s) => (
                  <option key={s} value={s}>{t(`shift_types.${s}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("notes_station")}</Label>
            <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder={t("notes_placeholder")} className="h-9 text-xs" />
          </div>

          {conflicts && conflicts.length > 0 && (
            <div className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded p-3 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> {t("scheduling_conflict")}
              </div>
              <ul className="space-y-1 list-disc list-inside">
                {conflicts.map((c) => (
                  <li key={c.scheduleId}>{t(`shift_types.${c.shiftType}`)} — {t(`status.${c.status}`)}</li>
                ))}
              </ul>
              <Button type="button" size="sm" variant="outline" className="border-orange-300 text-orange-800 hover:bg-orange-100" disabled={isSaving} onClick={() => submit(true)}>
                {t("assign_anyway")}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("assign_shift")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
