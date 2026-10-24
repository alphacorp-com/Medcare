"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { Field, jsonInit, selectClass, today } from "@/components/programs/form-bits";
import { money, useCoverageError } from "@/components/coverage/shared";
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";

// Patient file > Third-party payment: the memberships the patient is covered by — as holder or
// as a dependant (spouse, child…) of a holder who may not be a patient here —, the prior
// authorizations received from the payer, and the free-care enrolments. Every change recomputes
// the open invoices concerned on the server.

type Relationship = "holder" | "spouse" | "child" | "other";
type Authorization = { id: string; number: string; authorizedAmount: string | null; validFrom: string; validTo: string; status: "active" | "cancelled" };
type Beneficiary = { id: string; patientId: string; relationship: Relationship; beneficiaryNumber: string | null; endedAt: string | null; patient: { firstName: string; lastName: string; ipp: string } };
type Policy = {
  id: string; memberNumber: string; holderName: string; holderPatientId: string | null; employer: string | null; validFrom: string; validTo: string | null; endedAt: string | null;
  agreement: { id: string; name: string; requiresAuthorization: boolean; childMaxAgeYears: number | null; payer: { name: string } };
  beneficiaries: Beneficiary[];
};
type Coverage = {
  id: string; relationship: Relationship; beneficiaryNumber: string | null; validFrom: string; validTo: string | null; endedAt: string | null;
  policy: Policy;
  authorizations: Authorization[];
};
type Exemption = { id: string; validFrom: string; validTo: string | null; reason: string; revokedAt: string | null; program: { name: string; rate: number } };
type Overview = { coverages: Coverage[]; exemptions: Exemption[]; enrolmentPrograms: { id: string; name: string; rate: number }[] };
type Agreement = { id: string; name: string; payer: { name: string } };

type DialogState =
  | { kind: "coverage" }
  | { kind: "authorization"; coverage: Coverage }
  | { kind: "exemption" }
  | { kind: "revoke"; exemption: Exemption }
  | null;

const RELATIONSHIPS: Relationship[] = ["holder", "spouse", "child", "other"];

function useSave(patientId: string, onDone: () => void) {
  const queryClient = useQueryClient();
  const apiError = useCoverageError();
  const t = useTranslations("coverage");
  return useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body: unknown }) => apiFetch(url, jsonInit(method, body)),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["patient-coverage"] });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      onDone();
    },
    onError: (error) => toast.error(apiError(error)),
  });
}

export function CoverageTab({ patientId }: { patientId: string }) {
  const t = useTranslations("coverage.patient");
  const format = useFormatter();
  const hasPermission = useAppStore((s) => s.hasPermission);
  // UI only: every route checks MODULE_BILLING again ("validate" for free-care enrolments).
  const canCreate = hasPermission("MODULE_BILLING", "create");
  const canUpdate = hasPermission("MODULE_BILLING", "update");
  const canValidate = hasPermission("MODULE_BILLING", "validate");
  const [dialog, setDialog] = useState<DialogState>(null);
  const overview = useQuery({ queryKey: ["patient-coverage", patientId], queryFn: () => apiFetch<{ data: Overview }>(`/api/v1/patients/${patientId}/coverage`) });
  const save = useSave(patientId, () => undefined);
  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "…");
  const data = overview.data?.data;
  const todayTime = new Date(today()).getTime();
  const isActive = (c: Coverage) =>
    !c.endedAt && !c.policy.endedAt && (!c.validTo || new Date(c.validTo).getTime() >= todayTime) && (!c.policy.validTo || new Date(c.policy.validTo).getTime() >= todayTime);

  return (
    <div className="space-y-5 p-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("coverages")}</h3>
          {canCreate && <Button size="sm" className="h-7 text-[11px]" onClick={() => setDialog({ kind: "coverage" })}><Plus className="mr-1 h-3 w-3" /> {t("add_coverage")}</Button>}
        </div>
        {data?.coverages.length === 0 && <p className="text-xs italic text-slate-400">{t("no_coverage")}</p>}
        {data?.coverages.map((c) => {
          const others = c.policy.beneficiaries.filter((b) => b.patientId !== patientId);
          return (
            <div key={c.id} className="rounded border border-slate-200 bg-white p-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-800">{c.policy.agreement.payer.name} — {c.policy.agreement.name}</div>
                  <div className="text-slate-500">
                    {t("member_number")} <span className="font-mono">{c.policy.memberNumber}</span>
                    {c.beneficiaryNumber && <> · {t("beneficiary_number")} <span className="font-mono">{c.beneficiaryNumber}</span></>}
                    {c.policy.employer && <> · {c.policy.employer}</>}
                  </div>
                  <div className="text-slate-600">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold">{t(`relationship_${c.relationship}`)}</span>
                    {c.relationship !== "holder" && <> {t("holder_is", { name: c.policy.holderName })}</>}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t("beneficiary_validity")} {date(c.validFrom)} → {c.endedAt ? `${t("removed")} ${date(c.endedAt)}` : date(c.validTo)}
                    {" · "}{t("membership_validity")} {date(c.policy.validFrom)} → {c.policy.endedAt ? `${t("ended")} ${date(c.policy.endedAt)}` : date(c.policy.validTo)}
                  </div>
                  {c.relationship === "child" && c.policy.agreement.childMaxAgeYears !== null && <div className="text-[11px] text-amber-700">{t("child_age_limit", { age: c.policy.agreement.childMaxAgeYears })}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${isActive(c) ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{isActive(c) ? t("active") : t("inactive")}</span>
                  {canCreate && isActive(c) && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDialog({ kind: "authorization", coverage: c })}>{t("add_authorization")}</Button>}
                  {canUpdate && !c.endedAt && !c.policy.endedAt && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px] text-red-700" disabled={save.isPending}
                      onClick={() => window.confirm(t("remove_confirm")) && save.mutate({ url: `/api/v1/patients/${patientId}/coverage/${c.id}`, method: "PATCH", body: { end: true } })}>
                      {t("remove_beneficiary")}
                    </Button>
                  )}
                  {canUpdate && !c.policy.endedAt && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px] text-red-700" disabled={save.isPending}
                      onClick={() => window.confirm(t("end_policy_confirm", { count: c.policy.beneficiaries.length })) && save.mutate({ url: `/api/v1/coverage/policies/${c.policy.id}`, method: "PATCH", body: { end: true } })}>
                      {t("end_policy")}
                    </Button>
                  )}
                </div>
              </div>
              {others.length > 0 && (
                <div className="mt-1 text-[11px] text-slate-500">
                  {t("other_beneficiaries")}: {others.map((b) => `${b.patient.firstName} ${b.patient.lastName} (${t(`relationship_${b.relationship}`)}${b.endedAt ? `, ${t("removed")}` : ""})`).join(", ")}
                </div>
              )}
              {c.policy.agreement.requiresAuthorization && <p className="mt-1 text-[11px] text-amber-700">{t("authorization_required_hint")}</p>}
              {c.authorizations.length > 0 && (
                <table className="mt-2 w-full text-left text-[11px]">
                  <thead className="text-[10px] uppercase text-slate-400"><tr><th className="py-1">{t("authorization")}</th><th>{t("authorized_amount")}</th><th>{t("validity")}</th><th /></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.authorizations.map((a) => (
                      <tr key={a.id} className={a.status === "cancelled" ? "text-slate-400 line-through" : ""}>
                        <td className="py-1 font-mono">{a.number}</td>
                        <td>{a.authorizedAmount ? money(a.authorizedAmount) : t("no_limit")}</td>
                        <td>{date(a.validFrom)} → {date(a.validTo)}</td>
                        <td className="text-right">
                          {canUpdate && a.status === "active" && (
                            <button className="text-red-600 hover:underline" disabled={save.isPending}
                              onClick={() => window.confirm(t("cancel_authorization_confirm")) && save.mutate({ url: `/api/v1/patients/${patientId}/authorizations/${a.id}`, method: "PATCH", body: { status: "cancelled" } })}>
                              {t("cancel_authorization")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("exemptions")}</h3>
          {canValidate && (data?.enrolmentPrograms.length ?? 0) > 0 && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDialog({ kind: "exemption" })}><Plus className="mr-1 h-3 w-3" /> {t("grant_exemption")}</Button>}
        </div>
        <p className="text-[11px] text-slate-400">{t("automatic_hint")}</p>
        {data?.exemptions.length === 0 && <p className="text-xs italic text-slate-400">{t("no_exemption")}</p>}
        {data?.exemptions.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white p-3 text-xs">
            <div>
              <div className={`font-semibold ${e.revokedAt ? "text-slate-400 line-through" : "text-slate-800"}`}>{e.program.name} ({e.program.rate} %)</div>
              <div className="text-[11px] text-slate-500">{date(e.validFrom)} → {date(e.validTo)} · {e.reason}</div>
              {e.revokedAt && <div className="text-[11px] text-red-600">{t("revoked")} {date(e.revokedAt)}</div>}
            </div>
            {canValidate && !e.revokedAt && <Button size="sm" variant="outline" className="h-7 text-[11px] text-red-700" onClick={() => setDialog({ kind: "revoke", exemption: e })}>{t("revoke")}</Button>}
          </div>
        ))}
      </section>

      {dialog?.kind === "coverage" && <CoverageDialog patientId={patientId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "authorization" && <AuthorizationDialog patientId={patientId} coverage={dialog.coverage} onClose={() => setDialog(null)} />}
      {dialog?.kind === "exemption" && data && <ExemptionDialog patientId={patientId} programs={data.enrolmentPrograms} onClose={() => setDialog(null)} />}
      {dialog?.kind === "revoke" && <RevokeDialog patientId={patientId} exemption={dialog.exemption} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Footer({ onClose, disabled, onSave }: { onClose: () => void; disabled: boolean; onSave: () => void }) {
  const tc = useTranslations("common");
  return (
    <DialogFooter>
      <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
      <Button size="sm" disabled={disabled} onClick={onSave}>{tc("save")}</Button>
    </DialogFooter>
  );
}

// Step 1: convention + member number, looked up. Step 2: join the membership found, or create it.
function CoverageDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const t = useTranslations("coverage.patient");
  const apiError = useCoverageError();
  const agreements = useQuery({ queryKey: ["coverage", "agreements", "active"], queryFn: () => apiFetch<{ data: Agreement[] }>("/api/v1/coverage/agreements?active=true") });
  const [agreementId, setAgreementId] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [lookup, setLookup] = useState<{ done: boolean; policy: Policy | null }>({ done: false, policy: null });
  const [searching, setSearching] = useState(false);
  const [beneficiary, setBeneficiary] = useState({ relationship: "holder" as Relationship, beneficiaryNumber: "" });
  const [holder, setHolder] = useState({ isPatient: true, name: "", patientId: "", employer: "", validFrom: today(), validTo: "" });
  const save = useSave(patientId, onClose);

  const search = async () => {
    setSearching(true);
    try {
      const res = await apiFetch<{ data: Policy | null }>(`/api/v1/coverage/policies?agreementId=${agreementId}&memberNumber=${encodeURIComponent(memberNumber.trim())}`);
      setLookup({ done: true, policy: res.data });
      setBeneficiary((b) => ({ ...b, relationship: res.data ? "child" : "holder" }));
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setSearching(false);
    }
  };
  const reset = () => setLookup({ done: false, policy: null });
  const policy = lookup.policy;
  const alreadyIn = policy?.beneficiaries.some((b) => b.patientId === patientId);
  const holderTaken = Boolean(policy && (policy.holderPatientId || policy.beneficiaries.some((b) => b.relationship === "holder")));

  const submit = () => {
    const common = { relationship: beneficiary.relationship, beneficiaryNumber: beneficiary.beneficiaryNumber || null };
    if (policy) return save.mutate({ url: `/api/v1/patients/${patientId}/coverage`, method: "POST", body: { ...common, policyId: policy.id } });
    const isHolder = holder.isPatient;
    save.mutate({
      url: `/api/v1/patients/${patientId}/coverage`,
      method: "POST",
      body: {
        ...common,
        relationship: isHolder ? "holder" : beneficiary.relationship,
        policy: {
          // The server takes the holder's name from the patient file when the holder is a patient.
          agreementId, memberNumber: memberNumber.trim(), holderName: isHolder ? t("holder_self") : holder.name, holderPatientId: isHolder ? null : holder.patientId || null,
          employer: holder.employer || null, validFrom: holder.validFrom, validTo: holder.validTo || null,
        },
      },
    });
  };
  const canSubmit = lookup.done && !alreadyIn && !save.isPending && (policy ? true : holder.validFrom !== "" && (holder.isPatient || holder.name.trim().length > 0) && (holder.isPatient || beneficiary.relationship !== "holder"));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t("add_coverage")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("agreement")} className="col-span-2">
            <select value={agreementId} onChange={(e) => { setAgreementId(e.target.value); reset(); }} className={selectClass}>
              <option value="">—</option>
              {agreements.data?.data.map((a) => <option key={a.id} value={a.id}>{a.payer.name} — {a.name}</option>)}
            </select>
          </Field>
          {agreements.data?.data.length === 0 && <p className="col-span-2 text-[11px] text-amber-700">{t("no_agreement_hint")}</p>}
          <Field label={t("member_number")} className="col-span-2">
            <div className="flex gap-2">
              <Input value={memberNumber} maxLength={60} onChange={(e) => { setMemberNumber(e.target.value); reset(); }} className="h-8 text-xs" />
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!agreementId || !memberNumber.trim() || searching} onClick={search}><Search className="mr-1 h-3.5 w-3.5" /> {t("lookup")}</Button>
            </div>
          </Field>
        </div>

        {lookup.done && policy && (
          <div className="space-y-2 rounded border border-blue-200 bg-blue-50 p-3 text-xs">
            <p className="font-semibold text-blue-900">{t("policy_found", { holder: policy.holderName })}</p>
            <p className="text-blue-800">{policy.beneficiaries.map((b) => `${b.patient.firstName} ${b.patient.lastName} (${t(`relationship_${b.relationship}`)})`).join(", ") || t("no_beneficiary")}</p>
            {policy.endedAt && <p className="text-red-700">{t("policy_ended")}</p>}
            {alreadyIn && <p className="text-red-700">{t("already_beneficiary")}</p>}
          </div>
        )}
        {lookup.done && !policy && <p className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">{t("policy_new")}</p>}

        {lookup.done && !policy && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1 text-xs">
              <label className="flex items-center gap-2"><input type="radio" checked={holder.isPatient} onChange={() => setHolder((h) => ({ ...h, isPatient: true }))} /> {t("holder_is_patient")}</label>
              <label className="flex items-center gap-2"><input type="radio" checked={!holder.isPatient} onChange={() => { setHolder((h) => ({ ...h, isPatient: false })); setBeneficiary((b) => ({ ...b, relationship: "child" })); }} /> {t("holder_is_other")}</label>
            </div>
            {!holder.isPatient && (
              <>
                <Field label={t("holder_name")} className="col-span-2"><Input value={holder.name} maxLength={150} onChange={(e) => setHolder((h) => ({ ...h, name: e.target.value }))} className="h-8 text-xs" /></Field>
                <Field label={t("holder_patient")} className="col-span-2">
                  <PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => setHolder((h) => ({ ...h, patientId: p?.id ?? "", name: p ? `${p.lastName} ${p.firstName}` : h.name }))} />
                </Field>
                <p className="col-span-2 -mt-2 text-[11px] text-slate-400">{t("holder_patient_hint")}</p>
              </>
            )}
            <Field label={t("employer")}><Input value={holder.employer} maxLength={150} onChange={(e) => setHolder((h) => ({ ...h, employer: e.target.value }))} className="h-8 text-xs" /></Field>
            <div />
            <Field label={t("valid_from")}><Input type="date" value={holder.validFrom} onChange={(e) => setHolder((h) => ({ ...h, validFrom: e.target.value }))} className="h-8 text-xs" /></Field>
            <Field label={t("valid_to")}><Input type="date" value={holder.validTo} onChange={(e) => setHolder((h) => ({ ...h, validTo: e.target.value }))} className="h-8 text-xs" /></Field>
          </div>
        )}

        {lookup.done && !alreadyIn && (policy || !holder.isPatient) && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("relationship")}>
              <select value={beneficiary.relationship} onChange={(e) => setBeneficiary((b) => ({ ...b, relationship: e.target.value as Relationship }))} className={selectClass}>
                {RELATIONSHIPS.filter((r) => r !== "holder" || (policy ? !holderTaken : false)).map((r) => <option key={r} value={r}>{t(`relationship_${r}`)}</option>)}
              </select>
            </Field>
            <Field label={t("beneficiary_number")}><Input value={beneficiary.beneficiaryNumber} maxLength={60} placeholder={t("optional")} onChange={(e) => setBeneficiary((b) => ({ ...b, beneficiaryNumber: e.target.value }))} className="h-8 text-xs" /></Field>
          </div>
        )}
        <p className="text-[11px] text-slate-500">{t("open_invoices_hint")}</p>
        <Footer onClose={onClose} disabled={!canSubmit} onSave={submit} />
      </DialogContent>
    </Dialog>
  );
}

function AuthorizationDialog({ patientId, coverage, onClose }: { patientId: string; coverage: Coverage; onClose: () => void }) {
  const t = useTranslations("coverage.patient");
  const [form, setForm] = useState({ number: "", authorizedAmount: "", validFrom: today(), validTo: today(), notes: "" });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave(patientId, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("add_authorization")} — {coverage.policy.agreement.payer.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("authorization_number")}><Input value={form.number} maxLength={60} onChange={(e) => set({ number: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("authorized_amount")}><Input type="number" min={1} placeholder={t("no_limit")} value={form.authorizedAmount} onChange={(e) => set({ authorizedAmount: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("valid_from")}><Input type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("valid_to")}><Input type="date" value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("notes")} className="col-span-2"><Input value={form.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <Footer onClose={onClose} disabled={!form.number.trim() || save.isPending}
          onSave={() => save.mutate({ url: `/api/v1/patients/${patientId}/coverage/${coverage.id}/authorizations`, method: "POST", body: { ...form, authorizedAmount: form.authorizedAmount ? Number(form.authorizedAmount) : null, notes: form.notes || null } })} />
      </DialogContent>
    </Dialog>
  );
}

function ExemptionDialog({ patientId, programs, onClose }: { patientId: string; programs: Overview["enrolmentPrograms"]; onClose: () => void }) {
  const t = useTranslations("coverage.patient");
  const [form, setForm] = useState({ programId: programs[0]?.id ?? "", validFrom: today(), validTo: "", reason: "" });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave(patientId, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("grant_exemption")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("program")} className="col-span-2">
            <select value={form.programId} onChange={(e) => set({ programId: e.target.value })} className={selectClass}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.rate} %)</option>)}
            </select>
          </Field>
          <Field label={t("valid_from")}><Input type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("valid_to")}><Input type="date" value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("reason")} className="col-span-2"><Input value={form.reason} maxLength={500} placeholder={t("reason_hint")} onChange={(e) => set({ reason: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <Footer onClose={onClose} disabled={!form.programId || form.reason.trim().length < 5 || save.isPending}
          onSave={() => save.mutate({ url: `/api/v1/patients/${patientId}/exemptions`, method: "POST", body: { ...form, validTo: form.validTo || null } })} />
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({ patientId, exemption, onClose }: { patientId: string; exemption: Exemption; onClose: () => void }) {
  const t = useTranslations("coverage.patient");
  const [reason, setReason] = useState("");
  const save = useSave(patientId, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t("revoke")} — {exemption.program.name}</DialogTitle></DialogHeader>
        <Field label={t("reason")}><Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" /></Field>
        <Footer onClose={onClose} disabled={reason.trim().length < 5 || save.isPending}
          onSave={() => save.mutate({ url: `/api/v1/patients/${patientId}/exemptions/${exemption.id}`, method: "PATCH", body: { revoke: true, reason } })} />
      </DialogContent>
    </Dialog>
  );
}
