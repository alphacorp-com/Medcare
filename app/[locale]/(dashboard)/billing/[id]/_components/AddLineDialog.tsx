"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export function AddLineDialog({
  open,
  onOpenChange,
  invoiceId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  onSaved: () => void;
}) {
  const t = useTranslations("billing");

  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDescription("");
    setQuantity("1");
    setUnitPrice("");
    setError(null);
  };

  const handleSave = async () => {
    if (!description.trim() || !unitPrice) {
      setError(t("add_line_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/billing/${invoiceId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), quantity: Number(quantity) || 1, unitPrice: Number(unitPrice) }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("add_line_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
      reset();
    } catch {
      setError(t("add_line_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("add_line")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          <div className="space-y-1">
            <Label>{t("description")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>{t("quantity")}</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label>{t("unit_price")}</Label>
              <Input type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("close")}</Button>
          <Button disabled={isSaving} onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("add_line")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
