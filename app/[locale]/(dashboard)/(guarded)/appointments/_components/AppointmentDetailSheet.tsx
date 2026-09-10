"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, CheckCircle2, Loader2, UserX, XCircle } from "lucide-react";
import { Appointment, AppointmentConflict, Doctor } from "../types";

export function AppointmentDetailSheet({
  open,
  onOpenChange,
  appointment,
  doctors,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  doctors: Doctor[];
  onUpdated: () => void;
}) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");

  const [scheduledAt, setScheduledAt] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<AppointmentConflict[] | null>(null);

  if (!appointment) return null;

  const doctorName = doctors.find((d) => d.id === appointment.doctorId)?.fullName ?? appointment.doctorId;
  const canEdit = appointment.status === "booked" || appointment.status === "confirmed";

  const reschedule = async (force = false) => {
    setIsSaving(true);
    setError(null);
    if (!force) setConflicts(null);
    try {
      const res = await fetch(`/api/v1/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, force }),
      });
      if (res.status === 409) {
        const payload = await res.json();
        setConflicts(payload.conflicts ?? []);
        return;
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("reschedule_error"));
        return;
      }
      setScheduledAt("");
      onUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(t("reschedule_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const runAction = async (action: "check-in" | "cancel" | "no-show", body?: Record<string, unknown>) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/appointments/${appointment.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("action_error"));
        return;
      }
      onUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(t("action_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{appointment.patient.firstName} {appointment.patient.lastName}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="text-sm text-slate-600 space-y-1">
            <p>{tc("ipp")}: <span className="font-mono">{appointment.patient.ipp}</span></p>
            <p>{t("doctor")}: {doctorName}</p>
            <p>{tc("status")}: <span className="font-semibold">{t(`status_${appointment.status}`)}</span></p>
            {appointment.reasonForVisit && <p>{t("reason_for_visit")}: {appointment.reasonForVisit}</p>}
          </div>

          {canEdit && (
            <div className="space-y-3 border-t pt-4">
              <Label>{t("reschedule")}</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
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
                </div>
              )}
              <Button
                size="sm"
                disabled={isSaving || !scheduledAt}
                onClick={() => reschedule(Boolean(conflicts?.length))}
                className={conflicts?.length ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-blue-600 text-white hover:bg-blue-700"}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {conflicts?.length ? t("book_anyway") : t("reschedule")}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {canEdit && (
              <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" disabled={isSaving} onClick={() => runAction("check-in")}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {t("check_in")}
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50" disabled={isSaving} onClick={() => runAction("no-show")}>
                <UserX className="w-3.5 h-3.5 mr-1.5" /> {t("mark_no_show")}
              </Button>
            )}
            {canEdit && (
              <div className="flex items-end gap-2 w-full">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] uppercase text-slate-500">{t("cancel_reason")}</Label>
                  <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={isSaving}
                  onClick={() => runAction("cancel", { reason: cancelReason })}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> {t("cancel_appointment")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
