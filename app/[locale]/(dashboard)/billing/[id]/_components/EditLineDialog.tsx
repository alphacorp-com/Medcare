"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { InvoiceLine } from "../../types";

export function EditLineDialog({
  open,
  onOpenChange,
  invoiceId,
  line,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  line: InvoiceLine | null;
  onSaved: () => void;
}) {
  const t = useTranslations("billing");

  const [description, setDescription] = useState(line?.description ?? "");
  const [quantity, setQuantity] = useState(String(line ? Number(line.quantity) : 1));
  const [unitPrice, setUnitPrice] = useState(String(line ? Number(line.unitPrice) : ""));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!line) return null;

  const handleSave = async () => {
    if (!description.trim() || !unitPrice) {
      setError(t("add_line_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/billing/${invoiceId}/lines/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), quantity: Number(quantity) || 1, unitPrice: Number(unitPrice) }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("edit_line_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError(t("edit_line_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("edit_line")}</DialogTitle>
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
            {t("edit_line")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
