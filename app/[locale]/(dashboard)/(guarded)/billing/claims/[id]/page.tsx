"use client";

import { Fragment, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Banknote, Download, FileText, Send, Trash2, Lock } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Field, jsonInit } from "@/components/programs/form-bits";
import { money, useCoverageError } from "@/components/coverage/shared";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import { usePdfBranding } from "@/components/templates/usePdfBranding";
import type { PdfClaimData } from "@/components/templates/types";
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";
import { downloadCsv } from "@/lib/csv";
import { CLAIM_STATUS_TONE, PayerPaymentDialog } from "../../_components/ClaimsTab";

// One claim ("bordereau") to a payer: its invoices, what was settled and rejected, and the
// lifecycle actions (submit, settle, reject, close) — each settlement allocation and rejection can
// be reversed until the claim is closed. Exported as CSV or PDF for the payer.

type Relationship = "holder" | "spouse" | "child" | "other";
type Item = {
  id: string; claimedAmount: string; paidAmount: string; rejectedAmount: string;
  invoice: {
    id: string; createdAt: string; subtotal: string; insuranceAmount: string; patientAmount: string;
    patient: { firstName: string; lastName: string; ipp: string };
    coverage: { relationship: Relationship; beneficiaryNumber: string | null; policy: { memberNumber: string; holderName: string; agreement: { name: string } } } | null;
    authorization: { number: string } | null;
  };
  allocations: { id: string; amount: string; reversedAt: string | null; payment: { id: string; receivedAt: string; reference: string | null } }[];
  rejections: { id: string; amount: string; reason: string; chargedToPatient: boolean; createdAt: string; reversedAt: string | null; reversalReason: string | null }[];
};
type Claim = {
  id: string; number: string; status: string; periodStart: string; periodEnd: string; submittedAt: string | null; notes: string | null;
  payer: { id: string; name: string; code: string };
  items: Item[];
  payments: { id: string; amount: string; receivedAt: string; reference: string | null; method: string; status: string }[];
};
type Reversal = { kind: "rejection" | "allocation"; id: string; label: string };

const outstanding = (i: Item) => Number(i.claimedAmount) - Number(i.paidAmount) - Number(i.rejectedAmount);

export default function ClaimPage() {
  const t = useTranslations("coverage.claims");
  const tp = useTranslations("coverage.patient");
  const format = useFormatter();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const apiError = useCoverageError();
  const hasPermission = useAppStore((s) => s.hasPermission);
  const canUpdate = hasPermission("MODULE_BILLING", "update");
  const canDelete = hasPermission("MODULE_BILLING", "delete");
  const [paying, setPaying] = useState(false);
  const [rejecting, setRejecting] = useState<Item | null>(null);
  const [reversing, setReversing] = useState<Reversal | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const { facility: pdfFacility, settings: pdfSettings } = usePdfBranding();
  const claim = useQuery({ queryKey: ["billing", "claim", id], queryFn: () => apiFetch<{ data: Claim }>(`/api/v1/billing/claims/${id}`) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["billing"] });
  const action = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/api/v1/billing/claims/${id}`, jsonInit("PATCH", body)),
    onSuccess: () => { toast.success(t("saved")); refresh(); },
    onError: (error) => toast.error(apiError(error)),
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/v1/billing/claims/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success(t("claim_deleted")); refresh(); router.push("/billing?tab=claims"); },
    onError: (error) => toast.error(apiError(error)),
  });

  const c = claim.data?.data;
  if (!c) return <div className="p-6 text-xs text-slate-400">{claim.isError ? apiError(claim.error) : "…"}</div>;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short" });
  const sum = (f: (i: Item) => number) => c.items.reduce((s, i) => s + f(i), 0);
  const open = ["submitted", "partially_settled", "settled"].includes(c.status);
  const acceptsSettlement = c.status === "submitted" || c.status === "partially_settled";
  const beneficiaryOf = (i: Item) => {
    const cov = i.invoice.coverage;
    if (!cov) return "";
    const rel = tp(`relationship_${cov.relationship}`);
    return cov.relationship === "holder" ? rel : `${rel} — ${cov.policy.holderName}${cov.beneficiaryNumber ? ` (${cov.beneficiaryNumber})` : ""}`;
  };

  // Export of the claim for the payer (one line per invoice).
  const exportCsv = () => {
    downloadCsv(`${c.number}.csv`, [
      [t("title"), t("payer"), t("invoice_date"), t("patient"), "IPP", t("member"), t("holder"), t("beneficiary"), t("authorization"), t("invoice_amount"), t("claimed"), t("paid"), t("rejected")],
      ...c.items.map((i) => [
        c.number, c.payer.name, i.invoice.createdAt.slice(0, 10), `${i.invoice.patient.lastName} ${i.invoice.patient.firstName}`, i.invoice.patient.ipp,
        i.invoice.coverage?.policy.memberNumber ?? "", i.invoice.coverage?.policy.holderName ?? "", beneficiaryOf(i), i.invoice.authorization?.number ?? "",
        Number(i.invoice.subtotal), Number(i.claimedAmount), Number(i.paidAmount), Number(i.rejectedAmount),
      ]),
    ]);
  };
  const pdfData: PdfClaimData = {
    number: c.number,
    status: t(`status_${c.status}`),
    payerName: c.payer.name,
    period: `${date(c.periodStart)} → ${date(c.periodEnd)}`,
    submittedOn: c.submittedAt ? date(c.submittedAt) : null,
    currency: "XAF",
    notes: c.notes,
    items: c.items.map((i) => ({
      date: date(i.invoice.createdAt), patient: `${i.invoice.patient.lastName} ${i.invoice.patient.firstName}`, ipp: i.invoice.patient.ipp,
      memberNumber: i.invoice.coverage?.policy.memberNumber ?? "", beneficiary: beneficiaryOf(i), authorization: i.invoice.authorization?.number ?? null,
      invoiceAmount: Number(i.invoice.subtotal), claimed: Number(i.claimedAmount), paid: Number(i.paidAmount), rejected: Number(i.rejectedAmount),
    })),
    labels: {
      title: t("title"), status: t("status"), payer: t("payer"), period: t("period"), submitted_on: t("submitted_on_label"), invoices: t("invoices"),
      date: t("invoice_date"), patient: t("patient"), member: t("member"), beneficiary: t("beneficiary"), authorization: t("authorization"),
      invoice_amount: t("invoice_amount"), claimed: t("claimed"), paid: t("paid"), rejected: t("rejected"), totals: t("totals"), outstanding: t("outstanding"),
      facility_signature: t("facility_signature"), payer_signature: t("payer_signature"),
    },
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/billing?tab=claims" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-bold text-slate-900">{c.number}</h1>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${CLAIM_STATUS_TONE[c.status]}`}>{t(`status_${c.status}`)}</span>
            </div>
            <p className="text-xs text-slate-500">{c.payer.name} · {date(c.periodStart)} → {date(c.periodEnd)}{c.submittedAt ? ` · ${t("submitted_on")} ${date(c.submittedAt)}` : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCsv}><Download className="mr-1 h-3.5 w-3.5" /> {t("export")}</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPdfOpen(true)}><FileText className="mr-1 h-3.5 w-3.5" /> {t("export_pdf")}</Button>
          {canUpdate && c.status === "draft" && <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" disabled={action.isPending} onClick={() => window.confirm(t("submit_confirm")) && action.mutate({ action: "submit" })}><Send className="mr-1 h-3.5 w-3.5" /> {t("submit")}</Button>}
          {canDelete && c.status === "draft" && <Button size="sm" variant="outline" className="h-8 text-xs text-red-700" disabled={remove.isPending} onClick={() => window.confirm(t("delete_confirm")) && remove.mutate()}><Trash2 className="mr-1 h-3.5 w-3.5" /> {t("delete")}</Button>}
          {canUpdate && acceptsSettlement && <Button size="sm" className="h-8 text-xs" onClick={() => setPaying(true)}><Banknote className="mr-1 h-3.5 w-3.5" /> {t("record_settlement")}</Button>}
          {canUpdate && c.status === "settled" && <Button size="sm" variant="outline" className="h-8 text-xs" disabled={action.isPending} onClick={() => window.confirm(t("close_confirm")) && action.mutate({ action: "close" })}><Lock className="mr-1 h-3.5 w-3.5" /> {t("close")}</Button>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[["claimed", sum((i) => Number(i.claimedAmount)), "text-slate-900"], ["paid", sum((i) => Number(i.paidAmount)), "text-green-700"], ["rejected", sum((i) => Number(i.rejectedAmount)), "text-red-700"], ["outstanding", sum(outstanding), "text-blue-700"]].map(([key, value, tone]) => (
          <div key={key as string} className="rounded border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-bold uppercase text-slate-500">{t(key as string)}</div>
            <div className={`font-mono text-lg font-bold ${tone}`}>{money(value as number)}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr><th className="px-3 py-2">{t("invoice_date")}</th><th className="px-3 py-2">{t("patient")}</th><th className="px-3 py-2">{t("member")}</th><th className="px-3 py-2">{t("beneficiary")}</th><th className="px-3 py-2 text-right">{t("claimed")}</th><th className="px-3 py-2 text-right">{t("paid")}</th><th className="px-3 py-2 text-right">{t("rejected")}</th><th className="px-3 py-2 text-right">{t("outstanding")}</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {c.items.map((i) => {
              const events = [
                ...i.allocations.map((a) => ({ kind: "allocation" as const, id: a.id, at: a.payment.receivedAt, amount: a.amount, text: `${t("settled_by")} ${a.payment.reference ?? ""}`, reversedAt: a.reversedAt, extra: null as string | null })),
                ...i.rejections.map((r) => ({ kind: "rejection" as const, id: r.id, at: r.createdAt, amount: r.amount, text: `${t("rejected_for")} ${r.reason}${r.chargedToPatient ? ` (${t("charged_to_patient")})` : ""}`, reversedAt: r.reversedAt, extra: r.reversalReason })),
              ];
              return (
                <Fragment key={i.id}>
                  <tr>
                    <td className="px-3 py-2"><Link href={`/billing/${i.invoice.id}`} className="text-blue-600 hover:underline">{date(i.invoice.createdAt)}</Link></td>
                    <td className="px-3 py-2">{i.invoice.patient.firstName} {i.invoice.patient.lastName} <span className="font-mono text-[10px] text-slate-400">{i.invoice.patient.ipp}</span></td>
                    <td className="px-3 py-2 font-mono">{i.invoice.coverage?.policy.memberNumber}{i.invoice.authorization && <span className="ml-1 text-[10px] text-slate-400">({i.invoice.authorization.number})</span>}</td>
                    <td className="px-3 py-2 text-[11px]">{beneficiaryOf(i)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(i.claimedAmount)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{money(i.paidAmount)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">{Number(i.rejectedAmount) ? money(i.rejectedAmount) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{money(outstanding(i))}</td>
                    <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                      {canUpdate && c.status === "draft" && <button className="text-red-600 hover:underline" disabled={action.isPending} onClick={() => action.mutate({ action: "remove", itemId: i.id })}>{t("remove")}</button>}
                      {canUpdate && acceptsSettlement && outstanding(i) > 0 && <button className="text-red-600 hover:underline" onClick={() => setRejecting(i)}>{t("reject")}</button>}
                    </td>
                  </tr>
                  {events.length > 0 && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={9} className="px-6 py-1.5">
                        <ul className="space-y-0.5 text-[11px] text-slate-600">
                          {events.map((e) => (
                            <li key={e.id} className={e.reversedAt ? "text-slate-400 line-through" : ""}>
                              {date(e.at)} · <span className="font-mono">{money(e.amount)}</span> · {e.text}
                              {e.reversedAt && <span className="ml-1 no-underline">({t("reversed")}{e.extra ? `: ${e.extra}` : ""})</span>}
                              {canUpdate && open && !e.reversedAt && (
                                <button className="ml-2 text-blue-600 hover:underline" onClick={() => setReversing({ kind: e.kind, id: e.id, label: `${money(e.amount)} — ${e.text}` })}>{t("reverse")}</button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {c.payments.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-3 text-xs shadow-sm">
          <div className="mb-2 text-[10px] font-bold uppercase text-slate-500">{t("settlements")}</div>
          {c.payments.map((p) => (
            <div key={p.id} className={`flex justify-between py-0.5 ${p.status === "cancelled" ? "text-slate-400 line-through" : ""}`}>
              <span>{date(p.receivedAt)} · {t(`method_${p.method}`)} {p.reference ? `· ${p.reference}` : ""}</span><span className="font-mono">{money(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
      {c.notes && <p className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-sm">{c.notes}</p>}

      {paying && <PayerPaymentDialog payers={[c.payer]} claims={[{ id: c.id, number: c.number, status: c.status, payer: { id: c.payer.id } }]} fixedClaim={{ id: c.id, payerId: c.payer.id }} onClose={() => setPaying(false)} />}
      {rejecting && <RejectionDialog claimId={c.id} item={rejecting} onClose={() => setRejecting(null)} />}
      {reversing && <ReversalDialog claimId={c.id} reversal={reversing} onClose={() => setReversing(null)} />}
      <PDFPreviewModal isOpen={pdfOpen} onClose={() => setPdfOpen(false)} templateId="insurance_claims" data={pdfData} facility={pdfFacility} settings={pdfSettings} fileName={c.number} />
    </div>
  );
}

function RejectionDialog({ claimId, item, onClose }: { claimId: string; item: Item; onClose: () => void }) {
  const t = useTranslations("coverage.claims");
  const tc = useTranslations("common");
  const apiError = useCoverageError();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ amount: String(outstanding(item)), reason: "", chargeToPatient: false });
  const save = useMutation({
    mutationFn: () => apiFetch(`/api/v1/billing/claims/${claimId}/items/${item.id}/rejection`, jsonInit("POST", { amount: Number(form.amount), reason: form.reason, chargeToPatient: form.chargeToPatient })),
    onSuccess: () => { toast.success(t("saved")); queryClient.invalidateQueries({ queryKey: ["billing"] }); onClose(); },
    onError: (error) => toast.error(apiError(error)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t("reject")} — {item.invoice.patient.firstName} {item.invoice.patient.lastName}</DialogTitle></DialogHeader>
        <Field label={`${t("amount")} (max ${money(outstanding(item))})`}><Input type="number" min={1} max={outstanding(item)} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-8 text-xs" /></Field>
        <Field label={t("rejection_reason")}><Input value={form.reason} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="h-8 text-xs" /></Field>
        <Check label={t("charge_to_patient")} checked={form.chargeToPatient} onChange={(v) => setForm((f) => ({ ...f, chargeToPatient: v }))} />
        <p className="text-[11px] text-slate-500">{form.chargeToPatient ? t("charge_to_patient_hint") : t("write_off_hint")}</p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={!form.reason.trim() || !(Number(form.amount) > 0) || Number(form.amount) > outstanding(item) || save.isPending} onClick={() => save.mutate()}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Undoes a rejection (the payer pays after all) or an allocation (wrong invoice), with a reason.
function ReversalDialog({ claimId, reversal, onClose }: { claimId: string; reversal: Reversal; onClose: () => void }) {
  const t = useTranslations("coverage.claims");
  const tc = useTranslations("common");
  const apiError = useCoverageError();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () =>
      apiFetch(
        reversal.kind === "rejection" ? `/api/v1/billing/claims/${claimId}/rejections/${reversal.id}/reversal` : `/api/v1/billing/payer-allocations/${reversal.id}/reversal`,
        jsonInit("POST", { reason })
      ),
    onSuccess: () => { toast.success(t("saved")); queryClient.invalidateQueries({ queryKey: ["billing"] }); onClose(); },
    onError: (error) => toast.error(apiError(error)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t("reverse")}</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-600">{reversal.label}</p>
        <p className="text-[11px] text-slate-500">{reversal.kind === "rejection" ? t("reverse_rejection_hint") : t("reverse_allocation_hint")}</p>
        <Field label={t("reason")}><Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" /></Field>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={reason.trim().length < 5 || save.isPending} onClick={() => save.mutate()}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
