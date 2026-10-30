"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SettingsPageHeader, SettingsPill, settingsActionButtonClass } from "@/components/settings/settings-ui";
import { Check, Field, jsonInit, selectClass } from "@/components/programs/form-bits";
import { COVERAGE_FAMILIES, dateInput, money, optionalAmount, useCoverageError } from "@/components/coverage/shared";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Settings > Payers and conventions: who pays for its members, at which rate per family of acts,
// up to which ceilings, and whether a prior authorization is needed (lib/coverage).

type Rate = { family: string; rate: number };
type Agreement = {
  id: string; payerId: string; code: string; name: string; defaultRate: number; rates: Rate[];
  perInvoiceCeiling: string | null; annualCeiling: string | null; familyAnnualCeiling: string | null; childMaxAgeYears: number | null; useNomenclatureRates: boolean;
  requiresAuthorization: boolean; authorizationThreshold: string | null;
  validFrom: string | null; validTo: string | null; isActive: boolean; notes: string | null;
};
type Payer = {
  id: string; code: string; name: string; insuranceTypeId: string | null; insuranceType: { nameFr: string } | null;
  contactName: string | null; phone: string | null; email: string | null; address: string | null; isActive: boolean; agreements: Agreement[];
};
type CatalogItem = { id: string; nameFr: string; isActive: boolean };

const KEY = ["coverage", "payers"];

function useSave(onDone: () => void) {
  const queryClient = useQueryClient();
  const apiError = useCoverageError();
  const t = useTranslations("coverage");
  return useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body: unknown }) => apiFetch(url, jsonInit(method, body)),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: KEY });
      onDone();
    },
    onError: (error) => toast.error(apiError(error)),
  });
}

export default function PayersPage() {
  const t = useTranslations("coverage.payers");
  const tf = useTranslations("coverage.families");
  const [payerDialog, setPayerDialog] = useState<Payer | "new" | null>(null);
  const [agreementDialog, setAgreementDialog] = useState<{ payer: Payer; agreement: Agreement | null } | null>(null);
  const payers = useQuery({ queryKey: KEY, queryFn: () => apiFetch<{ data: Payer[] }>("/api/v1/coverage/payers") });

  return (
    <div className="space-y-4">
      <SettingsPageHeader
        title={t("title")}
        description={t("description")}
        actions={<Button size="sm" className={cn("h-8 text-xs bg-blue-600 hover:bg-blue-700", settingsActionButtonClass)} onClick={() => setPayerDialog("new")}><Plus className="mr-2 h-3.5 w-3.5" /> {t("new_payer")}</Button>}
      />
      {payers.data?.data.length === 0 && <p className="rounded border border-dashed border-slate-200 bg-white p-6 text-center text-xs italic text-slate-400">{t("empty")}</p>}
      {payers.data?.data.map((payer) => (
        <section key={payer.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{payer.name}</h2>
                <span className="font-mono text-[10px] text-slate-400">{payer.code}</span>
                {payer.insuranceType && <SettingsPill tone="blue">{payer.insuranceType.nameFr}</SettingsPill>}
                {!payer.isActive && <SettingsPill>{t("inactive")}</SettingsPill>}
              </div>
              <p className="text-[11px] text-slate-500">{[payer.contactName, payer.phone, payer.email].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setPayerDialog(payer)}><Pencil className="mr-1 h-3 w-3" /> {t("edit")}</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setAgreementDialog({ payer, agreement: null })}><Plus className="mr-1 h-3 w-3" /> {t("new_agreement")}</Button>
            </div>
          </header>
          <div className="divide-y divide-slate-100">
            {payer.agreements.length === 0 && <p className="px-4 py-3 text-xs italic text-slate-400">{t("no_agreements")}</p>}
            {payer.agreements.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{a.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">{a.code}</span>
                    {!a.isActive && <SettingsPill>{t("inactive")}</SettingsPill>}
                    {a.requiresAuthorization && <SettingsPill tone="emerald">{a.authorizationThreshold ? t("authorization_above", { amount: money(a.authorizationThreshold) }) : t("authorization_always")}</SettingsPill>}
                  </div>
                  <div className="text-slate-600">
                    {t("default_rate")} {a.defaultRate} %
                    {a.rates.map((r) => <span key={r.family} className="ml-2 text-slate-500">· {tf(r.family)} {r.rate} %</span>)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t("per_invoice_ceiling")}: {a.perInvoiceCeiling ? money(a.perInvoiceCeiling) : "—"} · {t("annual_ceiling")}: {a.annualCeiling ? money(a.annualCeiling) : "—"} · {t("family_annual_ceiling")}: {a.familyAnnualCeiling ? money(a.familyAnnualCeiling) : "—"}
                    {a.childMaxAgeYears !== null && <> · {t("child_age_limit", { age: a.childMaxAgeYears })}</>}
                    {a.useNomenclatureRates && <> · {t("nomenclature_applied")}</>}
                    {(a.validFrom || a.validTo) && <> · {dateInput(a.validFrom) || "…"} → {dateInput(a.validTo) || "…"}</>}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setAgreementDialog({ payer, agreement: a })}><Pencil className="mr-1 h-3 w-3" /> {t("edit")}</Button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {payerDialog && <PayerDialog payer={payerDialog === "new" ? null : payerDialog} onClose={() => setPayerDialog(null)} />}
      {agreementDialog && <AgreementDialog payer={agreementDialog.payer} agreement={agreementDialog.agreement} onClose={() => setAgreementDialog(null)} />}
    </div>
  );
}

function PayerDialog({ payer, onClose }: { payer: Payer | null; onClose: () => void }) {
  const t = useTranslations("coverage.payers");
  const tc = useTranslations("common");
  const types = useQuery({ queryKey: ["reference-data", "insurance_type"], queryFn: () => apiFetch<CatalogItem[]>("/api/v1/settings/reference-data/insurance_type") });
  const [form, setForm] = useState({
    code: payer?.code ?? "", name: payer?.name ?? "", insuranceTypeId: payer?.insuranceTypeId ?? "", contactName: payer?.contactName ?? "",
    phone: payer?.phone ?? "", email: payer?.email ?? "", address: payer?.address ?? "", isActive: payer?.isActive ?? true,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave(onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{payer ? payer.name : t("new_payer")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("code")}><Input value={form.code} maxLength={40} onChange={(e) => set({ code: e.target.value.toUpperCase() })} className="h-8 font-mono text-xs" /></Field>
          <Field label={t("insurance_type")}>
            <select value={form.insuranceTypeId} onChange={(e) => set({ insuranceTypeId: e.target.value })} className={selectClass}>
              <option value="">—</option>
              {types.data?.filter((i) => i.isActive).map((i) => <option key={i.id} value={i.id}>{i.nameFr}</option>)}
            </select>
          </Field>
          <Field label={t("name")} className="sm:col-span-2"><Input value={form.name} maxLength={150} onChange={(e) => set({ name: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("contact")}><Input value={form.contactName} maxLength={150} onChange={(e) => set({ contactName: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("phone")}><Input value={form.phone} maxLength={30} onChange={(e) => set({ phone: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("email")}><Input type="email" value={form.email} maxLength={150} onChange={(e) => set({ email: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("address")}><Input value={form.address} maxLength={255} onChange={(e) => set({ address: e.target.value })} className="h-8 text-xs" /></Field>
          <div className="sm:col-span-2"><Check label={t("active")} checked={form.isActive} onChange={(v) => set({ isActive: v })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={!form.code || !form.name || save.isPending} onClick={() => save.mutate({ url: payer ? `/api/v1/coverage/payers/${payer.id}` : "/api/v1/coverage/payers", method: payer ? "PATCH" : "POST", body: form })}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgreementDialog({ payer, agreement, onClose }: { payer: Payer; agreement: Agreement | null; onClose: () => void }) {
  const t = useTranslations("coverage.payers");
  const tf = useTranslations("coverage.families");
  const tc = useTranslations("common");
  const rateOf = (family: string) => agreement?.rates.find((r) => r.family === family)?.rate;
  const [form, setForm] = useState({
    code: agreement?.code ?? "", name: agreement?.name ?? "", defaultRate: String(agreement?.defaultRate ?? 80),
    rates: Object.fromEntries(COVERAGE_FAMILIES.map((f) => [f, rateOf(f) === undefined ? "" : String(rateOf(f))])) as Record<string, string>,
    perInvoiceCeiling: agreement?.perInvoiceCeiling ? String(Number(agreement.perInvoiceCeiling)) : "",
    annualCeiling: agreement?.annualCeiling ? String(Number(agreement.annualCeiling)) : "",
    familyAnnualCeiling: agreement?.familyAnnualCeiling ? String(Number(agreement.familyAnnualCeiling)) : "",
    childMaxAgeYears: agreement?.childMaxAgeYears?.toString() ?? "",
    useNomenclatureRates: agreement?.useNomenclatureRates ?? false,
    requiresAuthorization: agreement?.requiresAuthorization ?? false,
    authorizationThreshold: agreement?.authorizationThreshold ? String(Number(agreement.authorizationThreshold)) : "",
    validFrom: dateInput(agreement?.validFrom), validTo: dateInput(agreement?.validTo), isActive: agreement?.isActive ?? true, notes: agreement?.notes ?? "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave(onClose);
  const body = () => ({
    ...(agreement ? {} : { payerId: payer.id }),
    code: form.code, name: form.name, defaultRate: Number(form.defaultRate),
    // A family left blank follows the default rate.
    rates: COVERAGE_FAMILIES.filter((f) => form.rates[f].trim() !== "").map((f) => ({ family: f, rate: Number(form.rates[f]) })),
    perInvoiceCeiling: optionalAmount(form.perInvoiceCeiling), annualCeiling: optionalAmount(form.annualCeiling), familyAnnualCeiling: optionalAmount(form.familyAnnualCeiling),
    childMaxAgeYears: form.childMaxAgeYears.trim() === "" ? null : Number(form.childMaxAgeYears), useNomenclatureRates: form.useNomenclatureRates,
    requiresAuthorization: form.requiresAuthorization, authorizationThreshold: form.requiresAuthorization ? optionalAmount(form.authorizationThreshold) : null,
    validFrom: form.validFrom || null, validTo: form.validTo || null, isActive: form.isActive, notes: form.notes || null,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{agreement ? agreement.name : t("new_agreement")} — {payer.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t("code")}><Input value={form.code} maxLength={40} onChange={(e) => set({ code: e.target.value.toUpperCase() })} className="h-8 font-mono text-xs" /></Field>
          <Field label={t("name")} className="col-span-2"><Input value={form.name} maxLength={150} onChange={(e) => set({ name: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={`${t("default_rate")} (%)`}><Input type="number" min={0} max={100} value={form.defaultRate} onChange={(e) => set({ defaultRate: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-[10px] font-bold uppercase text-slate-500">{t("family_rates")}</legend>
          <p className="mb-2 text-[11px] text-slate-400">{t("family_rates_hint")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COVERAGE_FAMILIES.map((f) => (
              <Field key={f} label={tf(f)}>
                <Input type="number" min={0} max={100} placeholder={form.defaultRate} value={form.rates[f]} onChange={(e) => set({ rates: { ...form.rates, [f]: e.target.value } })} className="h-8 text-xs" />
              </Field>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t("per_invoice_ceiling")}><Input type="number" min={0} value={form.perInvoiceCeiling} onChange={(e) => set({ perInvoiceCeiling: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("annual_ceiling")}><Input type="number" min={0} value={form.annualCeiling} onChange={(e) => set({ annualCeiling: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("family_annual_ceiling")}><Input type="number" min={0} value={form.familyAnnualCeiling} onChange={(e) => set({ familyAnnualCeiling: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("child_max_age")}><Input type="number" min={1} max={99} placeholder={t("no_limit")} value={form.childMaxAgeYears} onChange={(e) => set({ childMaxAgeYears: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("valid_from")}><Input type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("valid_to")}><Input type="date" value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <Check label={t("use_nomenclature")} checked={form.useNomenclatureRates} onChange={(v) => set({ useNomenclatureRates: v })} />
        <p className="-mt-2 text-[11px] text-slate-400">{t("use_nomenclature_hint")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 items-end gap-3">
          <Check label={t("requires_authorization")} checked={form.requiresAuthorization} onChange={(v) => set({ requiresAuthorization: v })} />
          {form.requiresAuthorization && (
            <Field label={t("authorization_threshold")}><Input type="number" min={0} placeholder={t("always")} value={form.authorizationThreshold} onChange={(e) => set({ authorizationThreshold: e.target.value })} className="h-8 text-xs" /></Field>
          )}
        </div>
        <Field label={t("notes")}><Input value={form.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} className="h-8 text-xs" /></Field>
        <Check label={t("active")} checked={form.isActive} onChange={(v) => set({ isActive: v })} />
        {agreement && <p className="text-[11px] text-amber-700">{t("recompute_hint")}</p>}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={!form.code || !form.name || save.isPending} onClick={() => save.mutate({ url: agreement ? `/api/v1/coverage/agreements/${agreement.id}` : "/api/v1/coverage/agreements", method: agreement ? "PATCH" : "POST", body: body() })}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
