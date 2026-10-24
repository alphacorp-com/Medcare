"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { Check, Field, jsonInit, selectClass, today } from "@/components/programs/form-bits";
import { useProgramError } from "@/components/programs/use-program-error";
import { apiFetch } from "@/lib/api-client";

// RMA3 IV.4.1 / IV.4.4: diabetes and hypertension follow-up register (enrolment, visits, exit).

const CONDITIONS = ["diabetes", "hypertension"] as const;
const EXITS = ["lost_to_follow_up", "transferred", "died", "other"] as const;

type Visit = { visitDate: string; systolic: number | null; diastolic: number | null; hba1c: string | number | null };
type Enrolment = {
  id: string;
  condition: (typeof CONDITIONS)[number];
  enrolledAt: string;
  exitedAt: string | null;
  exitReason: (typeof EXITS)[number] | null;
  patient: { firstName: string; lastName: string; ipp: string };
  visits: Visit[];
};
type DialogState = { kind: "enrol" } | { kind: "visit" | "exit"; enrolment: Enrolment } | null;

function useSave(onDone: () => void) {
  const queryClient = useQueryClient();
  const apiError = useProgramError();
  const t = useTranslations("programs");
  return useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body: unknown }) => apiFetch(url, jsonInit(method, body)),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["chronic-enrolments"] });
      onDone();
    },
    onError: (error) => toast.error(apiError(error)),
  });
}

export function ChronicCareTab({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("programs.chronic");
  const format = useFormatter();
  const [activeOnly, setActiveOnly] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const enrolments = useQuery({
    queryKey: ["chronic-enrolments", activeOnly],
    queryFn: () => apiFetch<{ data: Enrolment[] }>(`/api/v1/chronic-care/enrolments${activeOnly ? "?active=true" : ""}`),
  });
  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "—");
  const lastVisit = (e: Enrolment) => {
    const v = e.visits[0];
    if (!v) return "—";
    const measures = [v.systolic !== null ? `${v.systolic}/${v.diastolic}` : null, v.hba1c !== null ? `HbA1c ${Number(v.hba1c)} %` : null].filter(Boolean);
    return `${date(v.visitDate)}${measures.length ? ` · ${measures.join(" · ")}` : ""}`;
  };
  return (
    <div className="flex-1 space-y-3 overflow-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Check label={t("active_only")} checked={activeOnly} onChange={setActiveOnly} />
        {canEdit && <Button size="sm" className="h-8 text-xs" onClick={() => setDialog({ kind: "enrol" })}><Plus className="h-3.5 w-3.5" /> {t("new_enrolment")}</Button>}
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("patient")}</th>
              <th className="px-3 py-2">{t("condition")}</th>
              <th className="px-3 py-2">{t("enrolled_at")}</th>
              <th className="px-3 py-2">{t("last_visit")}</th>
              <th className="px-3 py-2">{t("status")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {enrolments.data?.data.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center italic text-slate-400">{t("no_enrolments")}</td></tr>}
            {enrolments.data?.data.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2">{e.patient.firstName} {e.patient.lastName} <span className="font-mono text-[10px] text-slate-400">{e.patient.ipp}</span></td>
                <td className="px-3 py-2">{t(`condition_${e.condition}`)}</td>
                <td className="px-3 py-2">{date(e.enrolledAt)}</td>
                <td className="px-3 py-2">{lastVisit(e)}</td>
                <td className="px-3 py-2">{e.exitReason ? `${t(`exit_${e.exitReason}`)} (${date(e.exitedAt)})` : t("active")}</td>
                <td className="space-x-1 px-3 py-2 text-right">
                  {canEdit && !e.exitedAt && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDialog({ kind: "visit", enrolment: e })}>{t("new_visit")}</Button>}
                  {canEdit && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDialog({ kind: "exit", enrolment: e })}>{e.exitedAt ? t("reopen") : t("exit")}</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog?.kind === "enrol" && <EnrolDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "visit" && <VisitDialog enrolment={dialog.enrolment} onClose={() => setDialog(null)} />}
      {dialog?.kind === "exit" && <ExitDialog enrolment={dialog.enrolment} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Footer({ onClose, disabled, onSave }: { onClose: () => void; disabled: boolean; onSave: () => void }) {
  const tp = useTranslations("programs");
  return (
    <DialogFooter>
      <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
      <Button size="sm" disabled={disabled} onClick={onSave}>{tp("save")}</Button>
    </DialogFooter>
  );
}

function EnrolDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("programs.chronic");
  const [form, setForm] = useState({ patientId: "", condition: "diabetes" as (typeof CONDITIONS)[number], enrolledAt: today(), notes: "" });
  const save = useSave(onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("new_enrolment")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("patient")} className="col-span-2"><PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => setForm((f) => ({ ...f, patientId: p?.id ?? "" }))} /></Field>
          <Field label={t("condition")}>
            <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as (typeof CONDITIONS)[number] }))} className={selectClass}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{t(`condition_${c}`)}</option>)}
            </select>
          </Field>
          <Field label={t("enrolled_at")}><Input type="date" value={form.enrolledAt} max={today()} onChange={(e) => setForm((f) => ({ ...f, enrolledAt: e.target.value }))} className="h-8 text-xs" /></Field>
          <Field label={t("notes")} className="col-span-2"><Input value={form.notes} maxLength={1000} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="h-8 text-xs" /></Field>
        </div>
        <Footer onClose={onClose} disabled={!form.patientId || save.isPending} onSave={() => save.mutate({ url: "/api/v1/chronic-care/enrolments", method: "POST", body: form })} />
      </DialogContent>
    </Dialog>
  );
}

function VisitDialog({ enrolment, onClose }: { enrolment: Enrolment; onClose: () => void }) {
  const t = useTranslations("programs.chronic");
  const [form, setForm] = useState({ visitDate: today(), onTreatment: true, systolic: "", diastolic: "", hba1c: "", educationIndividual: false, educationGroup: false });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave(onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("new_visit")} — {enrolment.patient.firstName} {enrolment.patient.lastName}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("visit_date")}><Input type="date" value={form.visitDate} max={today()} onChange={(e) => set({ visitDate: e.target.value })} className="h-8 text-xs" /></Field>
          <div className="flex items-end"><Check label={t("on_treatment")} checked={form.onTreatment} onChange={(v) => set({ onTreatment: v })} /></div>
          <Field label={t("systolic")}><Input type="number" min={50} max={300} value={form.systolic} onChange={(e) => set({ systolic: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("diastolic")}><Input type="number" min={20} max={200} value={form.diastolic} onChange={(e) => set({ diastolic: e.target.value })} className="h-8 text-xs" /></Field>
          {enrolment.condition === "diabetes" && (
            <Field label={t("hba1c")}><Input type="number" step="0.1" min={3} max={20} value={form.hba1c} onChange={(e) => set({ hba1c: e.target.value })} className="h-8 text-xs" /></Field>
          )}
          <div className="col-span-2 space-y-1">
            <Check label={t("education_individual")} checked={form.educationIndividual} onChange={(v) => set({ educationIndividual: v })} />
            <Check label={t("education_group")} checked={form.educationGroup} onChange={(v) => set({ educationGroup: v })} />
          </div>
        </div>
        <Footer onClose={onClose} disabled={save.isPending} onSave={() => save.mutate({ url: `/api/v1/chronic-care/enrolments/${enrolment.id}/visits`, method: "POST", body: form })} />
      </DialogContent>
    </Dialog>
  );
}

function ExitDialog({ enrolment, onClose }: { enrolment: Enrolment; onClose: () => void }) {
  const t = useTranslations("programs.chronic");
  const reopening = Boolean(enrolment.exitedAt);
  const [form, setForm] = useState({ exitReason: "lost_to_follow_up" as (typeof EXITS)[number], exitedAt: today() });
  const save = useSave(onClose);
  const body = reopening ? { exitReason: null } : form;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{reopening ? t("reopen") : t("exit")} — {enrolment.patient.firstName} {enrolment.patient.lastName}</DialogTitle></DialogHeader>
        {reopening ? (
          <p className="text-sm text-slate-600">{t("reopen_confirm")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("exit_reason")}>
              <select value={form.exitReason} onChange={(e) => setForm((f) => ({ ...f, exitReason: e.target.value as (typeof EXITS)[number] }))} className={selectClass}>
                {EXITS.map((x) => <option key={x} value={x}>{t(`exit_${x}`)}</option>)}
              </select>
            </Field>
            <Field label={t("exited_at")}><Input type="date" value={form.exitedAt} max={today()} onChange={(e) => setForm((f) => ({ ...f, exitedAt: e.target.value }))} className="h-8 text-xs" /></Field>
          </div>
        )}
        <Footer onClose={onClose} disabled={save.isPending} onSave={() => save.mutate({ url: `/api/v1/chronic-care/enrolments/${enrolment.id}`, method: "PATCH", body })} />
      </DialogContent>
    </Dialog>
  );
}
