"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const AMNIOTIC_OPTIONS = ["clear", "meconium", "blood_stained", "absent"] as const;

export function PartographEntryDialog({
  open,
  onOpenChange,
  deliveryId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string;
  onSaved: () => void;
}) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");

  const [cervicalDilationCm, setCervicalDilationCm] = useState("");
  const [fetalHeartRate, setFetalHeartRate] = useState("");
  const [contractionsPer10Min, setContractionsPer10Min] = useState("");
  const [contractionDurationSec, setContractionDurationSec] = useState("");
  const [maternalPulse, setMaternalPulse] = useState("");
  const [maternalBpSystolic, setMaternalBpSystolic] = useState("");
  const [maternalBpDiastolic, setMaternalBpDiastolic] = useState("");
  const [amnioticFluid, setAmnioticFluid] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/maternity/deliveries/${deliveryId}/partograph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cervicalDilationCm: cervicalDilationCm || undefined,
          fetalHeartRate: fetalHeartRate || undefined,
          contractionsPer10Min: contractionsPer10Min || undefined,
          contractionDurationSec: contractionDurationSec || undefined,
          maternalPulse: maternalPulse || undefined,
          maternalBpSystolic: maternalBpSystolic || undefined,
          maternalBpDiastolic: maternalBpDiastolic || undefined,
          amnioticFluid: amnioticFluid || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("partograph_save_error"));
        return;
      }
      setCervicalDilationCm("");
      setFetalHeartRate("");
      setContractionsPer10Min("");
      setContractionDurationSec("");
      setMaternalPulse("");
      setMaternalBpSystolic("");
      setMaternalBpDiastolic("");
      setAmnioticFluid("");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("partograph_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("new_partograph_entry")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder={t("cervical_dilation_cm")} value={cervicalDilationCm} onChange={(e) => setCervicalDilationCm(e.target.value)} className="h-9 text-xs" />
            <Input type="number" placeholder={t("fetal_heart_rate")} value={fetalHeartRate} onChange={(e) => setFetalHeartRate(e.target.value)} className="h-9 text-xs" />
            <Input type="number" placeholder={t("contractions_per_10min")} value={contractionsPer10Min} onChange={(e) => setContractionsPer10Min(e.target.value)} className="h-9 text-xs" />
            <Input type="number" placeholder={t("contraction_duration_sec")} value={contractionDurationSec} onChange={(e) => setContractionDurationSec(e.target.value)} className="h-9 text-xs" />
            <Input type="number" placeholder={t("maternal_pulse")} value={maternalPulse} onChange={(e) => setMaternalPulse(e.target.value)} className="h-9 text-xs" />
            <div className="flex gap-1">
              <Input type="number" placeholder={t("bp_systolic")} value={maternalBpSystolic} onChange={(e) => setMaternalBpSystolic(e.target.value)} className="h-9 text-xs" />
              <Input type="number" placeholder={t("bp_diastolic")} value={maternalBpDiastolic} onChange={(e) => setMaternalBpDiastolic(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <select
            value={amnioticFluid}
            onChange={(e) => setAmnioticFluid(e.target.value)}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
          >
            <option value="">{t("amniotic_fluid")}</option>
            {AMNIOTIC_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{t(`amniotic_${opt}`)}</option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={isSaving} onClick={handleSave} className="bg-pink-600 text-white hover:bg-pink-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("save_entry")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
