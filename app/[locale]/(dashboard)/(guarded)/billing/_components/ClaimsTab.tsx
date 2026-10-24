"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Banknote, FilePlus2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, jsonInit, selectClass, today } from "@/components/programs/form-bits";
import { money, useCoverageError } from "@/components/coverage/shared";
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";

// Billing > Receivables: what each payer owes, the claims ("bordereaux") sent to them and the
// settlements received (lib/coverage/claims.ts).

type Receivable = { id: string; code: string; name: string; isActive: boolean; claimed: number; paid: number; rejected: number; outstanding: number; notYetClaimed: number };
type ClaimRow = { id: string; number: string; status: string; periodStart: string; periodEnd: string; payer: { id: string; name: string }; invoiceCount: number; claimed: number; paid: number; rejected: number };
type PayerPaymentRow = { id: string; amount: string; receivedAt: string; method: string; reference: string | null; allocated: number; payer: { name: string }; claim: { number: string } | null };
type Eligible = { id: string; createdAt: string; patient: { firstName: string; lastName: string; ipp: string }; memberNumber: string | null; insuranceAmount: number };

export const CLAIM_STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-100 text-blue-700",
  partially_settled: "bg-amber-100 text-amber-800",
  settled: "bg-green-100 text-green-700",
  closed: "bg-slate-200 text-slate-600",
};

const firstOfPreviousMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
};
const lastOfPreviousMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)).toISOString().slice(0, 10);
};

export function ClaimsTab() {
  const t = useTranslations("coverage.claims");
  const format = useFormatter();
  const hasPermission = useAppStore((s) => s.hasPermission);
  const canCreate = hasPermission("MODULE_BILLING", "create");
  const canUpdate = hasPermission("MODULE_BILLING", "update");
  const [dialog, setDialog] = useState<"claim" | "payment" | null>(null);
  const claims = useQuery({ queryKey: ["billing", "claims"], queryFn: () => apiFetch<{ data: ClaimRow[]; receivables: Receivable[] }>("/api/v1/billing/claims") });
  const payments = useQuery({ queryKey: ["billing", "payer-payments"], queryFn: () => apiFetch<{ data: PayerPaymentRow[] }>("/api/v1/billing/payer-payments") });
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short" });
  const receivables = (claims.data?.receivables ?? []).filter((r) => r.claimed > 0 || r.notYetClaimed > 0);

  return (
    <div className="flex-1 space-y-4 overflow-auto">
      <div className="flex flex-wrap justify-end gap-2">
        {canCreate && <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => setDialog("claim")}><FilePlus2 className="mr-2 h-3.5 w-3.5" /> {t("new_claim")}</Button>}
        {canUpdate && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDialog("payment")}><Banknote className="mr-2 h-3.5 w-3.5" /> {t("record_settlement")}</Button>}
      </div>

      <section className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("receivables")}</div>
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase text-slate-500">
            <tr><th className="px-4 py-2">{t("payer")}</th><th className="px-4 py-2 text-right">{t("not_yet_claimed")}</th><th className="px-4 py-2 text-right">{t("claimed")}</th><th className="px-4 py-2 text-right">{t("paid")}</th><th className="px-4 py-2 text-right">{t("rejected")}</th><th className="px-4 py-2 text-right">{t("outstanding")}</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {receivables.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center italic text-slate-400">{t("no_receivable")}</td></tr>}
            {receivables.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-semibold text-slate-800">{r.name}</td>
                <td className="px-4 py-2 text-right font-mono">{money(r.notYetClaimed)}</td>
                <td className="px-4 py-2 text-right font-mono">{money(r.claimed)}</td>
                <td className="px-4 py-2 text-right font-mono text-green-700">{money(r.paid)}</td>
                <td className="px-4 py-2 text-right font-mono text-red-700">{money(r.rejected)}</td>
                <td className="px-4 py-2 text-right font-mono font-bold text-blue-700">{money(r.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("claims")}</div>
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase text-slate-500">
            <tr><th className="px-4 py-2">{t("number")}</th><th className="px-4 py-2">{t("payer")}</th><th className="px-4 py-2">{t("period")}</th><th className="px-4 py-2">{t("status")}</th><th className="px-4 py-2 text-right">{t("invoices")}</th><th className="px-4 py-2 text-right">{t("claimed")}</th><th className="px-4 py-2 text-right">{t("paid")}</th><th className="px-4 py-2 text-right">{t("rejected")}</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {claims.data?.data.length === 0 && <tr><td colSpan={8} className="px-4 py-4 text-center italic text-slate-400">{t("no_claim")}</td></tr>}
            {claims.data?.data.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2"><Link href={`/billing/claims/${c.id}`} className="font-mono font-semibold text-blue-600 hover:underline">{c.number}</Link></td>
                <td className="px-4 py-2">{c.payer.name}</td>
                <td className="px-4 py-2">{date(c.periodStart)} → {date(c.periodEnd)}</td>
                <td className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${CLAIM_STATUS_TONE[c.status]}`}>{t(`status_${c.status}`)}</span></td>
                <td className="px-4 py-2 text-right">{c.invoiceCount}</td>
                <td className="px-4 py-2 text-right font-mono">{money(c.claimed)}</td>
                <td className="px-4 py-2 text-right font-mono text-green-700">{money(c.paid)}</td>
                <td className="px-4 py-2 text-right font-mono text-red-700">{money(c.rejected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("settlements")}</div>
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase text-slate-500">
            <tr><th className="px-4 py-2">{t("received_at")}</th><th className="px-4 py-2">{t("payer")}</th><th className="px-4 py-2">{t("claim")}</th><th className="px-4 py-2">{t("method")}</th><th className="px-4 py-2">{t("reference")}</th><th className="px-4 py-2 text-right">{t("amount")}</th><th className="px-4 py-2 text-right">{t("unallocated")}</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.data?.data.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-center italic text-slate-400">{t("no_settlement")}</td></tr>}
            {payments.data?.data.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">{date(p.receivedAt)}</td>
                <td className="px-4 py-2">{p.payer.name}</td>
                <td className="px-4 py-2 font-mono">{p.claim?.number ?? "—"}</td>
                <td className="px-4 py-2">{t(`method_${p.method}`)}</td>
                <td className="px-4 py-2 font-mono">{p.reference ?? "—"}</td>
                <td className="px-4 py-2 text-right font-mono">{money(p.amount)}</td>
                <td className="px-4 py-2 text-right font-mono text-amber-700">{Number(p.amount) - p.allocated > 0 ? money(Number(p.amount) - p.allocated) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {dialog === "claim" && <NewClaimDialog payers={claims.data?.receivables ?? []} onClose={() => setDialog(null)} />}
      {dialog === "payment" && <PayerPaymentDialog payers={claims.data?.receivables ?? []} claims={claims.data?.data ?? []} onClose={() => setDialog(null)} />}
    </div>
  );
}

function NewClaimDialog({ payers, onClose }: { payers: Receivable[]; onClose: () => void }) {
  const t = useTranslations("coverage.claims");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const apiError = useCoverageError();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ payerId: payers.find((p) => p.isActive)?.id ?? "", from: firstOfPreviousMonth(), to: lastOfPreviousMonth(), notes: "" });
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const eligible = useQuery({
    queryKey: ["billing", "claims", "eligible", form.payerId, form.from, form.to],
    queryFn: () => apiFetch<{ data: Eligible[] }>(`/api/v1/billing/claims/eligible?payerId=${form.payerId}&from=${form.from}&to=${form.to}`),
    enabled: Boolean(form.payerId && form.from && form.to && form.from <= form.to),
  });
  const selected = (eligible.data?.data ?? []).filter((i) => !excluded.has(i.id));
  const create = useMutation({
    mutationFn: () => apiFetch<{ data: { id: string } }>("/api/v1/billing/claims", jsonInit("POST", { payerId: form.payerId, periodStart: form.from, periodEnd: form.to, invoiceIds: selected.map((i) => i.id), notes: form.notes || null })),
    onSuccess: ({ data }) => {
      toast.success(t("claim_created"));
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      router.push(`/billing/claims/${data.id}`);
    },
    onError: (error) => toast.error(apiError(error)),
  });
  const toggle = (id: string) => setExcluded((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t("new_claim")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("payer")}>
            <select value={form.payerId} onChange={(e) => { setForm((f) => ({ ...f, payerId: e.target.value })); setExcluded(new Set()); }} className={selectClass}>
              <option value="">—</option>
              {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label={t("from")}><Input type="date" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} className="h-8 text-xs" /></Field>
          <Field label={t("to")}><Input type="date" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} className="h-8 text-xs" /></Field>
        </div>
        <p className="text-[11px] text-slate-500">{t("eligible_hint")}</p>
        <div className="max-h-72 overflow-y-auto rounded border border-slate-200">
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-slate-100">
              {eligible.data?.data.length === 0 && <tr><td className="px-3 py-4 text-center italic text-slate-400">{t("no_eligible")}</td></tr>}
              {eligible.data?.data.map((i) => (
                <tr key={i.id}>
                  <td className="w-8 px-3 py-1.5"><input type="checkbox" checked={!excluded.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4" /></td>
                  <td className="px-2 py-1.5">{format.dateTime(new Date(i.createdAt), { dateStyle: "short" })}</td>
                  <td className="px-2 py-1.5">{i.patient.firstName} {i.patient.lastName} <span className="font-mono text-[10px] text-slate-400">{i.patient.ipp}</span></td>
                  <td className="px-2 py-1.5 font-mono">{i.memberNumber}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{money(i.insuranceAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between text-xs font-semibold"><span>{t("selected", { count: selected.length })}</span><span className="font-mono">{money(selected.reduce((s, i) => s + i.insuranceAmount, 0))}</span></div>
        <Field label={t("notes")}><Input value={form.notes} maxLength={1000} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="h-8 text-xs" /></Field>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={selected.length === 0 || create.isPending} onClick={() => create.mutate()}>{t("create_draft")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PayerPaymentDialog({ payers, claims, fixedClaim, onClose }: { payers: { id: string; name: string }[]; claims: { id: string; number: string; status: string; payer: { id: string } }[]; fixedClaim?: { id: string; payerId: string }; onClose: () => void }) {
  const t = useTranslations("coverage.claims");
  const tc = useTranslations("common");
  const apiError = useCoverageError();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ payerId: fixedClaim?.payerId ?? payers[0]?.id ?? "", claimId: fixedClaim?.id ?? "", amount: "", receivedAt: today(), method: "bank_transfer", reference: "", notes: "" });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const openClaims = claims.filter((c) => c.payer.id === form.payerId && (c.status === "submitted" || c.status === "partially_settled"));
  const save = useMutation({
    mutationFn: () => apiFetch<{ data: { allocated: number } }>("/api/v1/billing/payer-payments", jsonInit("POST", { ...form, claimId: form.claimId || null, amount: Number(form.amount), reference: form.reference || null, notes: form.notes || null })),
    onSuccess: ({ data }) => {
      toast.success(t("settlement_recorded", { allocated: money(data.allocated) }));
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      onClose();
    },
    onError: (error) => toast.error(apiError(error)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("record_settlement")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("payer")}>
            <select value={form.payerId} disabled={Boolean(fixedClaim)} onChange={(e) => set({ payerId: e.target.value, claimId: "" })} className={selectClass}>
              {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label={t("claim")}>
            <select value={form.claimId} disabled={Boolean(fixedClaim)} onChange={(e) => set({ claimId: e.target.value })} className={selectClass}>
              <option value="">{t("all_open_claims")}</option>
              {openClaims.map((c) => <option key={c.id} value={c.id}>{c.number}</option>)}
            </select>
          </Field>
          <Field label={t("amount")}><Input type="number" min={1} value={form.amount} onChange={(e) => set({ amount: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("received_at")}><Input type="date" value={form.receivedAt} max={today()} onChange={(e) => set({ receivedAt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("method")}>
            <select value={form.method} onChange={(e) => set({ method: e.target.value })} className={selectClass}>
              {["bank_transfer", "cheque", "cash", "mobile_money", "other"].map((m) => <option key={m} value={m}>{t(`method_${m}`)}</option>)}
            </select>
          </Field>
          <Field label={t("reference")}><Input value={form.reference} maxLength={120} onChange={(e) => set({ reference: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <p className="text-[11px] text-slate-500">{t("allocation_hint")}</p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={!form.payerId || !(Number(form.amount) > 0) || save.isPending} onClick={() => save.mutate()}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
