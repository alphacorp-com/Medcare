"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, jsonInit, selectClass } from "@/components/programs/form-bits";
import { money, useCoverageError } from "@/components/coverage/shared";
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";
import type { InvoiceDetail } from "../../types";

// What the patient paid beyond their share on this invoice (coverage applied late, exemption,
// cancellation, duplicate payment…): given back, or moved to another open invoice of the patient.
// The history of both, and what came in from other invoices, stays visible.

const REFUND_METHODS = ["cash", "mobile_money_orange", "mobile_money_mtn", "bank_transfer", "card"] as const;

export function OverpaymentPanel({ invoice, onSaved }: { invoice: InvoiceDetail; onSaved: () => void }) {
  const t = useTranslations("coverage.overpayment");
  const format = useFormatter();
  // UI only: the route requires MODULE_BILLING "validate".
  const canValidate = useAppStore((s) => s.hasPermission("MODULE_BILLING", "validate"));
  const [mode, setMode] = useState<"refund" | "transfer" | null>(null);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short" });
  if (invoice.refundable <= 0 && invoice.refunds.length === 0 && invoice.creditsIn.length === 0) return null;

  return (
    <div className="space-y-2 rounded border border-green-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("title")}</div>
      {invoice.refundable > 0 && (
        <>
          <div className="flex justify-between text-sm font-bold text-green-800"><span>{t("refundable")}</span><span>{money(invoice.refundable, invoice.currency)}</span></div>
          <p className="text-[11px] text-slate-500">{invoice.status === "cancelled" ? t("cancelled_hint") : t("hint")}</p>
          {canValidate ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setMode("refund")}>{t("refund")}</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={invoice.transferTargets.length === 0} title={invoice.transferTargets.length === 0 ? t("no_target") : undefined} onClick={() => setMode("transfer")}>{t("transfer")}</Button>
            </div>
          ) : (
            <p className="text-[11px] text-amber-700">{t("needs_validate")}</p>
          )}
        </>
      )}
      {invoice.refunds.length > 0 && (
        <ul className="space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
          {invoice.refunds.map((r) => (
            <li key={r.id}>
              {date(r.refundedAt)} · {r.kind === "refund" ? `${t("refunded")} (${r.method ? t(`method_${r.method}`) : ""})` : <>{t("transferred_to")} <Link href={`/billing/${r.targetInvoice?.id}`} className="text-blue-600 underline">{r.targetInvoice ? date(r.targetInvoice.createdAt) : "—"}</Link></>}
              {" "}<span className="font-mono">{money(r.amount, invoice.currency)}</span> — {r.reason}
            </li>
          ))}
        </ul>
      )}
      {invoice.creditsIn.length > 0 && (
        <ul className="space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
          {invoice.creditsIn.map((c) => (
            <li key={c.id}>{date(c.refundedAt)} · {t("received_from")} <Link href={`/billing/${c.invoiceId}`} className="text-blue-600 underline">{t("other_invoice")}</Link> <span className="font-mono">{money(c.amount, invoice.currency)}</span></li>
          ))}
        </ul>
      )}
      {mode && <OverpaymentDialog invoice={invoice} mode={mode} onClose={() => setMode(null)} onSaved={onSaved} />}
    </div>
  );
}

function OverpaymentDialog({ invoice, mode, onClose, onSaved }: { invoice: InvoiceDetail; mode: "refund" | "transfer"; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("coverage.overpayment");
  const tc = useTranslations("common");
  const apiError = useCoverageError();
  const format = useFormatter();
  const [form, setForm] = useState({ amount: String(invoice.refundable), method: "cash", reference: "", targetInvoiceId: invoice.transferTargets[0]?.id ?? "", reason: "" });
  const [saving, setSaving] = useState(false);
  const target = invoice.transferTargets.find((x) => x.id === form.targetInvoiceId);
  const max = mode === "transfer" && target ? Math.min(invoice.refundable, target.due) : invoice.refundable;
  const submit = async () => {
    setSaving(true);
    try {
      const body = mode === "refund"
        ? { kind: "refund", amount: Number(form.amount), method: form.method, reference: form.reference || null, reason: form.reason }
        : { kind: "transfer", amount: Number(form.amount), targetInvoiceId: form.targetInvoiceId, reason: form.reason };
      await apiFetch(`/api/v1/billing/${invoice.id}/refunds`, jsonInit("POST", body));
      toast.success(mode === "refund" ? t("refund_done") : t("transfer_done"));
      onSaved();
      onClose();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setSaving(false);
    }
  };
  const amount = Number(form.amount);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{mode === "refund" ? t("refund") : t("transfer")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {mode === "transfer" && (
            <Field label={t("target_invoice")} className="col-span-2">
              <select value={form.targetInvoiceId} onChange={(e) => setForm((f) => ({ ...f, targetInvoiceId: e.target.value }))} className={selectClass}>
                {invoice.transferTargets.map((x) => <option key={x.id} value={x.id}>{format.dateTime(new Date(x.createdAt), { dateStyle: "short" })}{x.stayNumber ? ` · ${x.stayNumber}` : ""} — {t("due")} {money(x.due, invoice.currency)}</option>)}
              </select>
            </Field>
          )}
          <Field label={`${t("amount")} (max ${money(max, invoice.currency)})`}><Input type="number" min={1} max={max} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-8 text-xs" /></Field>
          {mode === "refund" && (
            <Field label={t("method")}>
              <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} className={selectClass}>
                {REFUND_METHODS.map((m) => <option key={m} value={m}>{t(`method_${m}`)}</option>)}
              </select>
            </Field>
          )}
          {mode === "refund" && <Field label={t("reference")} className="col-span-2"><Input value={form.reference} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} className="h-8 text-xs" /></Field>}
          <Field label={t("reason")} className="col-span-2"><Input value={form.reason} maxLength={500} placeholder={t("reason_hint")} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="h-8 text-xs" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={saving || !(amount > 0) || amount > max || form.reason.trim().length < 5 || (mode === "transfer" && !form.targetInvoiceId)} onClick={submit}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
