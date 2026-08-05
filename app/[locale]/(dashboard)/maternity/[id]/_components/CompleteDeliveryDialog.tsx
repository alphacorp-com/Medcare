"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { DeliveryMode } from "../../types";

const MODES: DeliveryMode[] = ["vaginal", "assisted_vaginal", "cesarean"];
const COMPLICATION_OPTIONS = ["postpartum_hemorrhage", "perineal_tear", "eclampsia", "obstructed_labour", "none"];

export function CompleteDeliveryDialog({
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

  const [mode, setMode] = useState<DeliveryMode>("vaginal");
  const [complications, setComplications] = useState<string[]>([]);
  const [maternalOutcome, setMaternalOutcome] = useState("alive");
  const [placentaDelivered, setPlacentaDelivered] = useState(false);
  const [bloodLossMl, setBloodLossMl] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleComplication = (key: string) => {
    setComplications((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/maternity/deliveries/${deliveryId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          complications,
          maternalOutcome,
          placentaDelivered,
          bloodLossMl: bloodLossMl || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("complete_delivery_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("complete_delivery_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("complete_delivery")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="space-y-1">
            <Label>{t("delivery_mode")}</Label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as DeliveryMode)}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            >
              {MODES.map((m) => (
                <option key={m} value={m}>{t(`mode_${m}`)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>{t("complications")}</Label>
            <div className="grid grid-cols-2 gap-1">
              {COMPLICATION_OPTIONS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={complications.includes(key)} onChange={() => toggleComplication(key)} className="h-4 w-4 rounded border-slate-300" />
                  {t(`complication_${key}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("maternal_outcome")}</Label>
            <select
              value={maternalOutcome}
              onChange={(e) => setMaternalOutcome(e.target.value)}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            >
              <option value="alive">{t("outcome_alive")}</option>
              <option value="deceased">{t("outcome_deceased")}</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={placentaDelivered} onChange={(e) => setPlacentaDelivered(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t("placenta_delivered")}
          </label>

          <div className="space-y-1">
            <Label>{t("blood_loss_ml")}</Label>
            <Input type="number" value={bloodLossMl} onChange={(e) => setBloodLossMl(e.target.value)} className="h-9 text-xs" />
          </div>

          <div className="space-y-1">
            <Label>{t("notes")}</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={isSaving} onClick={handleSave} className="bg-green-600 text-white hover:bg-green-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("complete_delivery")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
