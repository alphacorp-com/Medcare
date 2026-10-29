"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ImagingDevice, RadiologyConflict, RadiologyExam } from "../types";

const DURATIONS = [10, 15, 20, 30, 45, 60];

export function ScheduleExamDialog({
  open,
  onOpenChange,
  exam,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: RadiologyExam | null;
  onScheduled: () => void;
}) {
  const t = useTranslations("radiology");
  const tc = useTranslations("common");

  const [scheduledAt, setScheduledAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<RadiologyConflict[] | null>(null);
  const [devices, setDevices] = useState<ImagingDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [duration, setDuration] = useState("20");

  // Active imaging devices of the facility (Settings → Imaging devices).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/settings/imaging-devices");
        const json = await res.json();
        if (!cancelled && res.ok) setDevices((json.data ?? []).filter((d: ImagingDevice) => d.isActive));
      } catch (err) {
        console.error("Failed to fetch imaging devices", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!exam) return null;

  const submit = async (force = false) => {
    setIsSaving(true);
    setError(null);
    if (!force) setConflicts(null);
    try {
      const res = await fetch(`/api/v1/radiology/${exam.id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, deviceId: deviceId || undefined, expectedDurationMinutes: duration || undefined, force }),
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
      setScheduledAt("");
      onScheduled();
      onOpenChange(false);
    } catch (err) {
      setError(t("schedule_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedule_exam")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
          <p className="text-sm text-slate-600">{exam.examLabel} — {exam.patient.firstName} {exam.patient.lastName}</p>
          <div className="space-y-2">
            <Label>{tc("date")} & {tc("time")}</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("device")}</Label>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
              >
                <option value="">{t("no_device")}</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.label}
                  </option>
                ))}
              </select>
              {devices.length === 0 && <p className="text-[11px] text-slate-500">{t("no_device_hint")}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t("expected_duration")}</Label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
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
                  <li key={`${c.resource ?? "patient"}-${c.examRequestId}`}>
                    {c.resource === "device" ? t("conflict_device") : t("conflict_patient")} — {c.examLabel}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          {conflicts && conflicts.length > 0 ? (
            <Button disabled={isSaving} onClick={() => submit(true)} className="bg-orange-600 text-white hover:bg-orange-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("schedule_anyway")}
            </Button>
          ) : (
            <Button disabled={isSaving || !scheduledAt} onClick={() => submit(false)} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("schedule_exam")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
