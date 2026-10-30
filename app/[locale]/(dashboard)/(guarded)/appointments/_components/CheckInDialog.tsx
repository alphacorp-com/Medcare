"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MedicalActSelect, useMedicalActs } from "@/components/shared/medical-act-select";
import { notifyBillingGenerated } from "@/lib/billing/client";
import { Appointment } from "../types";

// Check-in of an appointment: the billable act is chosen here, as at a front-desk admission.
// Required as soon as acts are configured (same rule as the admission sheet); the API refuses a
// check-in without act while billing is active, and the patient then waits for payment at the
// cashier before reaching the consultation queue.
export function CheckInDialog({
  appointment,
  onOpenChange,
  onCheckedIn,
}: {
  appointment: Appointment | null;
  onOpenChange: (open: boolean) => void;
  onCheckedIn: () => void;
}) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const { acts, loaded } = useMedicalActs();
  const actRequired = acts.length > 0;
  const [actCode, setActCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setActCode("");
    setError(null);
    onOpenChange(false);
  };

  const submit = async () => {
    if (!appointment) return;
    if (actRequired && !actCode) return setError(t("check_in_act_required"));
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/appointments/${appointment.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actCode ? { medicalActCode: actCode } : {}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error === "medical_act_required" ? (acts.length === 0 ? t("check_in_no_acts") : t("check_in_act_required")) : payload?.error || t("action_error"));
        return;
      }
      notifyBillingGenerated(payload?.billing, tc("invoice_generated"));
      toast.success(payload?.stay?.consultationStatus === "awaiting_payment" ? t("checked_in_awaiting_payment") : t("checked_in_success"));
      close();
      onCheckedIn();
    } catch {
      setError(t("action_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(appointment)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("check_in")}</DialogTitle>
          {appointment && (
            <DialogDescription>
              {appointment.patient.firstName} {appointment.patient.lastName} — {tc("ipp")} {appointment.patient.ipp}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
          <MedicalActSelect acts={acts} value={actCode} onChange={setActCode} optional={!actRequired} />
          {actRequired && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("check_in_payment_hint")}
            </p>
          )}
          {loaded && acts.length === 0 && <p className="text-xs text-slate-500">{t("check_in_no_acts")}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {tc("cancel")}
          </Button>
          <Button disabled={isSaving || !loaded || (actRequired && !actCode)} onClick={submit} className="bg-green-600 text-white hover:bg-green-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {t("check_in")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
