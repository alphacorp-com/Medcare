"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2, Package, PenLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyBillingGenerated } from "@/lib/billing/client";
import { COMPLICATION_KEYS, OPERATIVE_TIME_FIELDS } from "@/lib/surgery/validation";
import { cn } from "@/lib/utils";
import { Surgery } from "../types";
import { FieldLabel, SheetError, SheetSection, SurgerySheet, surgeryInputClass, surgerySelectClass } from "./SurgerySheetLayout";

type StockArticle = { id: string; name: string; unit: string | null; dispensable: number };
type SupplyRow = {
  kind: "consumable" | "implant";
  itemId: string;
  itemName: string;
  quantity: string;
  lotNumber: string;
  serialNumber: string;
  manufacturer: string;
};
const NEW_ROW = (kind: SupplyRow["kind"]): SupplyRow => ({ kind, itemId: "", itemName: "", quantity: "1", lotNumber: "", serialNumber: "", manufacturer: "" });

// "2026-10-29T08:15" (local) for <input type="datetime-local">.
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function CompleteSurgerySheet({
  open,
  onOpenChange,
  surgery,
  isSurgeon,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surgery: Surgery | null;
  // Only the operating surgeon signs the operative report (enforced by the API too).
  isSurgeon: boolean;
  onCompleted: () => void;
}) {
  const t = useTranslations("surgery");
  const tc = useTranslations("common");

  const [surgicalReport, setSurgicalReport] = useState("");
  const [anesthesiaReport, setAnesthesiaReport] = useState("");
  const [complications, setComplications] = useState<string[]>([]);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [supplies, setSupplies] = useState<SupplyRow[]>([]);
  const [articles, setArticles] = useState<StockArticle[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stock articles that can be taken out (loaded when the sheet opens).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/stock/prescribable");
        const json = await res.json();
        if (!cancelled && res.ok) setArticles(json.data ?? []);
      } catch (err) {
        console.error("Failed to fetch stock articles", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!surgery) return null;

  // "none" excludes every actual complication, and the reverse.
  const toggleComplication = (key: string) =>
    setComplications((prev) => {
      if (prev.includes(key)) return prev.filter((c) => c !== key);
      return key === "none" ? ["none"] : [...prev.filter((c) => c !== "none"), key];
    });

  const setSupply = (index: number, patch: Partial<SupplyRow>) => setSupplies((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!surgicalReport.trim()) return setError(t("surgical_report_required"));
    setIsSaving(true);
    setError(null);
    try {
      const operativeTimes = Object.fromEntries(
        OPERATIVE_TIME_FIELDS.filter((f) => times[f]).map((f) => [f, new Date(times[f]).toISOString()])
      );
      const res = await fetch(`/api/v1/surgeries/${surgery.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surgicalReport,
          anesthesiaReport: anesthesiaReport || undefined,
          complications,
          ...operativeTimes,
          supplies: supplies.map((row) => ({
            kind: row.kind,
            itemId: row.itemId || undefined,
            itemName: row.itemName || undefined,
            quantity: Number(row.quantity),
            lotNumber: row.lotNumber || undefined,
            serialNumber: row.serialNumber || undefined,
            manufacturer: row.manufacturer || undefined,
          })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.code === "insufficient_stock" ? t("supply_insufficient_stock", { item: payload?.item ?? "", available: payload?.available ?? 0 }) : payload?.error || t("complete_error"));
        return;
      }
      notifyBillingGenerated(payload?.billing, tc("invoice_generated"));
      setSurgicalReport("");
      setAnesthesiaReport("");
      setComplications([]);
      setTimes({});
      setSupplies([]);
      onCompleted();
      onOpenChange(false);
    } catch {
      setError(t("complete_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SurgerySheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("complete_sign")}
      description={t("complete_sign_desc")}
      surgery={surgery}
      width="sm:max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="complete-surgery-form" disabled={isSaving || !isSurgeon} className="bg-green-600 text-white hover:bg-green-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PenLine className="h-4 w-4 mr-2" />}
            {t("complete_sign")}
          </Button>
        </>
      }
    >
      <form id="complete-surgery-form" onSubmit={handleSubmit} className="space-y-4">
        <SheetError message={error} />
        {!isSurgeon && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("only_surgeon_signs")}
          </div>
        )}

        <SheetSection icon={Clock} title={t("operative_times")} hint={t("operative_times_hint")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPERATIVE_TIME_FIELDS.map((field) => (
              <div key={field}>
                <FieldLabel>{t(`times.${field}`)}</FieldLabel>
                <Input
                  type="datetime-local"
                  value={times[field] ?? ""}
                  min={toLocalInput(surgery.startedAt)}
                  onChange={(e) => setTimes((prev) => ({ ...prev, [field]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </SheetSection>

        <SheetSection icon={FileText} title={t("operative_report")}>
          <div>
            <FieldLabel required>{t("surgical_report")}</FieldLabel>
            <textarea
              required
              value={surgicalReport}
              onChange={(e) => setSurgicalReport(e.target.value)}
              rows={7}
              className={surgeryInputClass}
              placeholder={t("surgical_report_placeholder")}
            />
          </div>
          <div>
            <FieldLabel>{t("anesthesia_report")}</FieldLabel>
            <textarea value={anesthesiaReport} onChange={(e) => setAnesthesiaReport(e.target.value)} rows={3} className={surgeryInputClass} />
          </div>
          <div>
            <FieldLabel>{t("complications")}</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {COMPLICATION_KEYS.map((key) => {
                const active = complications.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleComplication(key)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
                      active
                        ? key === "none"
                          ? "border-green-600 bg-green-50 text-green-700"
                          : "border-red-500 bg-red-50 text-red-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {t(`complication_options.${key}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </SheetSection>

        <SheetSection icon={Package} title={t("supplies_title")} hint={t("supplies_hint")}>
          {supplies.length === 0 && <p className="text-xs text-slate-400 italic">{t("no_supplies")}</p>}
          {supplies.map((row, index) => {
            const article = articles.find((a) => a.id === row.itemId);
            return (
              <div key={index} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", row.kind === "implant" ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-700")}>
                    {t(`supply_kinds.${row.kind}`)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-red-600 hover:bg-red-50"
                    aria-label={tc("delete")}
                    onClick={() => setSupplies((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_6rem] gap-2">
                  <div>
                    <FieldLabel required={row.kind === "consumable"}>{t("supply_article")}</FieldLabel>
                    <select value={row.itemId} onChange={(e) => setSupply(index, { itemId: e.target.value })} className={surgerySelectClass}>
                      <option value="">{row.kind === "implant" ? t("supply_outside_stock") : t("select_article")}</option>
                      {articles.map((a) => (
                        <option key={a.id} value={a.id} disabled={a.dispensable <= 0}>
                          {a.name} — {a.dispensable} {a.unit ?? ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel required>{t("quantity")}</FieldLabel>
                    <Input type="number" min={1} max={article?.dispensable || undefined} value={row.quantity} onChange={(e) => setSupply(index, { quantity: e.target.value })} />
                  </div>
                </div>
                {row.kind === "implant" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {!row.itemId && (
                      <div className="sm:col-span-2">
                        <FieldLabel required>{t("implant_name")}</FieldLabel>
                        <Input value={row.itemName} onChange={(e) => setSupply(index, { itemName: e.target.value })} />
                      </div>
                    )}
                    {!row.itemId && (
                      <div>
                        <FieldLabel>{t("lot_number")}</FieldLabel>
                        <Input value={row.lotNumber} onChange={(e) => setSupply(index, { lotNumber: e.target.value })} className="font-mono" />
                      </div>
                    )}
                    <div>
                      <FieldLabel>{t("serial_number")}</FieldLabel>
                      <Input value={row.serialNumber} onChange={(e) => setSupply(index, { serialNumber: e.target.value })} className="font-mono" />
                    </div>
                    <div className={cn(row.itemId && "sm:col-span-1")}>
                      <FieldLabel>{t("manufacturer")}</FieldLabel>
                      <Input value={row.manufacturer} onChange={(e) => setSupply(index, { manufacturer: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSupplies((prev) => [...prev, NEW_ROW("consumable")])}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> {t("add_consumable")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSupplies((prev) => [...prev, NEW_ROW("implant")])}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> {t("add_implant")}
            </Button>
          </div>
        </SheetSection>

        <p className="flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-[11px] text-slate-600">
          <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("signature_notice")}
        </p>
      </form>
    </SurgerySheet>
  );
}
