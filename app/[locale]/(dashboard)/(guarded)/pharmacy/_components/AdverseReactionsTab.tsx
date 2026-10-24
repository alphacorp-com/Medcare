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
import type { InventoryRow } from "../types";

// Pharmacovigilance register (RMA3 V.8): adverse drug reactions and their investigation.

type Reaction = {
  id: string;
  reactionAt: string;
  drugName: string;
  lotNumber: string | null;
  expiryDate: string | null;
  description: string;
  serious: boolean;
  investigatedAt: string | null;
  outcome: string | null;
  patient: { firstName: string; lastName: string; ipp: string };
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

function useSave(onDone: () => void) {
  const queryClient = useQueryClient();
  const apiError = useProgramError();
  const t = useTranslations("programs");
  return useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body: unknown }) => apiFetch(url, jsonInit(method, body)),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["adverse-reactions"] });
      onDone();
    },
    onError: (error) => toast.error(apiError(error)),
  });
}

export function AdverseReactionsTab({ inventory, canCreate, canUpdate }: { inventory: InventoryRow[]; canCreate: boolean; canUpdate: boolean }) {
  const t = useTranslations("programs.pharmacovigilance");
  const format = useFormatter();
  const [month, setMonth] = useState(currentMonth);
  const [creating, setCreating] = useState(false);
  const [investigating, setInvestigating] = useState<Reaction | null>(null);
  const reactions = useQuery({ queryKey: ["adverse-reactions", month], queryFn: () => apiFetch<{ data: Reaction[] }>(`/api/v1/pharmacy/adverse-reactions?month=${month}`) });
  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "—");
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Field label={t("month")}><Input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-40 text-xs" /></Field>
        {canCreate && <Button size="sm" className="h-8 text-xs" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> {t("new_reaction")}</Button>}
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("reaction_at")}</th>
              <th className="px-3 py-2">{t("patient")}</th>
              <th className="px-3 py-2">{t("drug")}</th>
              <th className="px-3 py-2">{t("description")}</th>
              <th className="px-3 py-2">{t("serious")}</th>
              <th className="px-3 py-2">{t("investigation")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reactions.data?.data.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center italic text-slate-400">{t("no_reactions")}</td></tr>}
            {reactions.data?.data.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{date(r.reactionAt)}</td>
                <td className="px-3 py-2">{r.patient.firstName} {r.patient.lastName}</td>
                <td className="px-3 py-2">{r.drugName}{r.lotNumber ? ` · ${t("lot")} ${r.lotNumber}` : ""}{r.expiryDate ? ` · ${date(r.expiryDate)}` : ""}</td>
                <td className="max-w-xs truncate px-3 py-2" title={r.description}>{r.description}</td>
                <td className="px-3 py-2">{r.serious ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{t("serious")}</span> : "—"}</td>
                <td className="px-3 py-2">{r.investigatedAt ? `${date(r.investigatedAt)}${r.outcome ? ` · ${r.outcome}` : ""}` : "—"}</td>
                <td className="px-3 py-2 text-right">{canUpdate && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setInvestigating(r)}>{t("investigate")}</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <ReactionDialog inventory={inventory} onClose={() => setCreating(false)} />}
      {investigating && <InvestigationDialog reaction={investigating} onClose={() => setInvestigating(null)} />}
    </div>
  );
}

function ReactionDialog({ inventory, onClose }: { inventory: InventoryRow[]; onClose: () => void }) {
  const t = useTranslations("programs.pharmacovigilance");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({ patientId: "", inventoryId: "", drugName: "", lotNumber: "", expiryDate: "", reactionAt: today(), description: "", serious: false });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave(onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t("new_reaction")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("patient")} className="col-span-2"><PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => set({ patientId: p?.id ?? "" })} /></Field>
          <Field label={t("article")}>
            <select value={form.inventoryId} onChange={(e) => set({ inventoryId: e.target.value })} className={selectClass}>
              <option value="">{t("other_drug")}</option>
              {inventory.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          {!form.inventoryId && <Field label={t("drug")}><Input value={form.drugName} maxLength={255} onChange={(e) => set({ drugName: e.target.value })} className="h-8 text-xs" /></Field>}
          <Field label={t("lot")}><Input value={form.lotNumber} maxLength={60} onChange={(e) => set({ lotNumber: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("expiry")}><Input type="date" value={form.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("reaction_at")}><Input type="date" value={form.reactionAt} max={today()} onChange={(e) => set({ reactionAt: e.target.value })} className="h-8 text-xs" /></Field>
          <div className="flex items-end"><Check label={t("serious")} checked={form.serious} onChange={(v) => set({ serious: v })} /></div>
          <Field label={t("description")} className="col-span-2">
            <textarea value={form.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} className="min-h-[70px] w-full rounded-md border border-slate-200 px-3 py-2 text-xs" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={!form.patientId || save.isPending} onClick={() => save.mutate({ url: "/api/v1/pharmacy/adverse-reactions", method: "POST", body: form })}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvestigationDialog({ reaction, onClose }: { reaction: Reaction; onClose: () => void }) {
  const t = useTranslations("programs.pharmacovigilance");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({ investigatedAt: reaction.investigatedAt?.slice(0, 10) ?? today(), outcome: reaction.outcome ?? "" });
  const save = useSave(onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t("investigation")} — {reaction.drugName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={t("investigated_at")}><Input type="date" value={form.investigatedAt} max={today()} onChange={(e) => setForm((f) => ({ ...f, investigatedAt: e.target.value }))} className="h-8 text-xs" /></Field>
          <Field label={t("outcome")}><Input value={form.outcome} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} className="h-8 text-xs" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ url: `/api/v1/pharmacy/adverse-reactions/${reaction.id}`, method: "PATCH", body: form })}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
