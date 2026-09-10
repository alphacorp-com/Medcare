"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";

export function NewInvoiceSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (invoiceId: string) => void;
}) {
  const t = useTranslations("billing");
  const tc = useTranslations("common");

  const [patientId, setPatientId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPatientId("");
    setDescription("");
    setQuantity("1");
    setUnitPrice("");
    setNotes("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!patientId || !description.trim() || !unitPrice) {
      setError(t("new_invoice_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          description: description.trim(),
          quantity: Number(quantity) || 1,
          unitPrice: Number(unitPrice),
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || t("create_error"));
        return;
      }
      onCreated(json.id);
      onOpenChange(false);
      reset();
    } catch {
      setError(t("create_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("new_invoice")}</SheetTitle>
          <SheetDescription className="text-xs">{t("new_invoice_desc")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

            <div className="space-y-1">
              <Label>{tc("patient")}</Label>
              <PatientSearchAutocomplete className="h-9 text-xs" onSelect={(patient) => setPatientId(patient?.id ?? "")} />
            </div>

            <div className="space-y-1">
              <Label>{t("description")}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("quantity")}</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <Label>{t("unit_price")}</Label>
                <Input type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("notes")}</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              />
            </div>
          </div>

          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              {t("create_invoice")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
