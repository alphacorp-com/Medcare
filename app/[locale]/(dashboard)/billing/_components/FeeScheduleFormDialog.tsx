"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { BillingSourceType, SOURCE_TYPES } from "../types";

export function FeeScheduleFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("billing");

  const [sourceType, setSourceType] = useState<BillingSourceType>("consultation");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSourceType("consultation");
    setCode("");
    setLabel("");
    setUnitPrice("");
    setError(null);
  };

  const handleSave = async () => {
    if (!code.trim() || !label.trim() || !unitPrice) {
      setError(t("fee_schedule_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/billing/fee-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, code: code.trim().toUpperCase(), label: label.trim(), unitPrice: Number(unitPrice) }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("fee_schedule_save_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
      reset();
    } catch {
      setError(t("fee_schedule_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("new_tariff")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          <div className="space-y-1">
            <Label>{t("source_type")}</Label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as BillingSourceType)}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>{t(`source_${s}`)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>{t("tariff_code")}</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("tariff_code_placeholder")} className="h-9 text-xs font-mono uppercase" />
          </div>

          <div className="space-y-1">
            <Label>{t("tariff_label")}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-9 text-xs" />
          </div>

          <div className="space-y-1">
            <Label>{t("unit_price")} (XAF)</Label>
            <Input type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="h-9 text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("close")}</Button>
          <Button disabled={isSaving} onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("save_tariff")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
