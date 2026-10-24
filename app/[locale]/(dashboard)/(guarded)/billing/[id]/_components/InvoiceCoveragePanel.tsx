"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Field, jsonInit, selectClass } from "@/components/programs/form-bits";
import { money, useCoverageError } from "@/components/coverage/shared";
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";
import type { InvoiceDetail } from "../../types";

// Third-party payment of an invoice: the coverage and prior authorization applied, the outcome of
// the computation, and the claim it is in. The cashier can change the coverage / authorization
// until the invoice is claimed; the server recomputes the split.

const STATUS_TONE: Record<InvoiceDetail["coverageStatus"], string> = {
  none: "bg-slate-100 text-slate-600",
  applied: "bg-green-100 text-green-700",
  capped: "bg-amber-100 text-amber-800",
  authorization_required: "bg-red-100 text-red-700",
  invalid_coverage: "bg-red-100 text-red-700",
  age_limit_exceeded: "bg-red-100 text-red-700",
  frozen: "bg-blue-100 text-blue-700",
};

export function InvoiceCoveragePanel({ invoice, onSaved }: { invoice: InvoiceDetail; onSaved: () => void }) {
  const t = useTranslations("coverage.invoice");
  const tp = useTranslations("coverage.patient");
  const apiError = useCoverageError();
  const canUpdate = useAppStore((s) => s.hasPermission("MODULE_BILLING", "update"));
  const [coverageId, setCoverageId] = useState(invoice.coverageId ?? "");
  const [authorizationId, setAuthorizationId] = useState(invoice.authorizationId ?? "");
  const [saving, setSaving] = useState(false);
  const selected = invoice.coverageOptions.find((c) => c.id === coverageId);
  const editable = canUpdate && !invoice.isClaimed && invoice.status !== "cancelled";
  const dirty = coverageId !== (invoice.coverageId ?? "") || authorizationId !== (invoice.authorizationId ?? "");

  const apply = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/billing/${invoice.id}`, jsonInit("PATCH", { coverageId: coverageId || null, authorizationId: authorizationId || null }));
      toast.success(t("recomputed"));
      onSaved();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const liveClaim = invoice.claimItems[0];

  return (
    <div className="space-y-2 rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("title")}</div>
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[invoice.coverageStatus]}`}>{t(`status_${invoice.coverageStatus}`)}</span>
      </div>
      {invoice.coverage ? (
        <div className="text-xs text-slate-700">
          <div className="font-semibold">{invoice.coverage.policy.agreement.payer.name}</div>
          <div className="text-slate-500">{invoice.coverage.policy.agreement.name} · {t("member")} <span className="font-mono">{invoice.coverage.policy.memberNumber}</span></div>
          {invoice.coverage.relationship !== "holder" && <div className="text-slate-500">{tp(`relationship_${invoice.coverage.relationship}`)} — {tp("holder_is", { name: invoice.coverage.policy.holderName })}</div>}
          {invoice.authorization && <div className="text-slate-500">{t("authorization")} <span className="font-mono">{invoice.authorization.number}</span></div>}
        </div>
      ) : (
        <p className="text-xs italic text-slate-400">{t("no_coverage")}</p>
      )}
      {invoice.coverageStatus === "authorization_required" && <p className="text-[11px] text-red-700">{t("authorization_required_hint")}</p>}
      {invoice.coverageStatus === "invalid_coverage" && <p className="text-[11px] text-red-700">{t("invalid_coverage_hint")}</p>}
      {invoice.coverageStatus === "capped" && <p className="text-[11px] text-amber-700">{t("capped_hint")}</p>}
      {invoice.coverageStatus === "age_limit_exceeded" && <p className="text-[11px] text-red-700">{t("age_limit_hint")}</p>}

      {liveClaim && (
        <div className="rounded bg-blue-50 p-2 text-[11px] text-blue-800">
          {t("in_claim")} <Link href={`/billing/claims/${liveClaim.claim.id}`} className="font-mono font-semibold underline">{liveClaim.claim.number}</Link>
          {" · "}{t("claimed")} {money(liveClaim.claimedAmount)} · {t("settled")} {money(liveClaim.paidAmount)}
          {Number(liveClaim.rejectedAmount) > 0 && <> · {t("rejected")} {money(liveClaim.rejectedAmount)}</>}
          {liveClaim.rejections.map((r, i) => <div key={i} className="mt-1 text-red-700">{money(r.amount)} — {r.reason}{r.chargedToPatient ? ` (${t("charged_to_patient")})` : ""}</div>)}
        </div>
      )}

      {editable && (
        <div className="space-y-2 border-t border-slate-100 pt-2">
          <Field label={t("coverage")}>
            <select value={coverageId} onChange={(e) => { setCoverageId(e.target.value); setAuthorizationId(""); }} className={selectClass}>
              <option value="">{t("no_coverage_option")}</option>
              {invoice.coverageOptions.map((c) => (
                <option key={c.id} value={c.id} disabled={Boolean(c.endedAt || c.policy.endedAt)}>
                  {c.policy.agreement.payer.name} — {c.policy.agreement.name} ({c.policy.memberNumber}, {tp(`relationship_${c.relationship}`)}){c.endedAt || c.policy.endedAt ? ` — ${t("ended")}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {selected && selected.authorizations.length > 0 && (
            <Field label={t("authorization")}>
              <select value={authorizationId} onChange={(e) => setAuthorizationId(e.target.value)} className={selectClass}>
                <option value="">{t("authorization_auto")}</option>
                {selected.authorizations.map((a) => <option key={a.id} value={a.id}>{a.number}{a.authorizedAmount ? ` — ${money(a.authorizedAmount)}` : ""}</option>)}
              </select>
            </Field>
          )}
          {invoice.coverageOptions.length === 0 && <p className="text-[11px] text-slate-400">{t("add_from_patient")}</p>}
          <Button size="sm" variant="outline" className="h-8 w-full text-xs" disabled={saving} onClick={apply}>{dirty ? t("apply") : t("recompute")}</Button>
          {Number(invoice.paidAmount) > 0 && dirty && <p className="text-[11px] text-amber-700">{t("paid_warning")}</p>}
        </div>
      )}
    </div>
  );
}
