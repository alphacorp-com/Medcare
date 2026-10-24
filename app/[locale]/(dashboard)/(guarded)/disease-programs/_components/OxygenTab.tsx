"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { Check, Field, jsonInit, selectClass, today } from "@/components/programs/form-bits";
import { useProgramError } from "@/components/programs/use-program-error";
import { apiFetch } from "@/lib/api-client";
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES, HYPOXEMIA_OUTCOMES } from "@/lib/programs/input";
import { EpiMonthPicker, currentMonth } from "./epi-shared";

// RMA3 V.9: biomedical equipment park (oximeters, concentrators, ventilators, cylinders) and
// hypoxaemia / respiratory distress episodes. The oxygen stock is in the pharmacy.

type Equipment = { id: string; code: string; type: string; label: string; location: string | null; status: string };
type Episode = {
  id: string;
  detectedAt: string;
  spo2: number | null;
  respiratoryDistress: boolean;
  oxygenGiven: boolean;
  outcome: string | null;
  patient: { firstName: string; lastName: string; ipp: string };
};

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["oxygen"] });
}

export function OxygenTab({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("programs.oxygen");
  const format = useFormatter();
  const apiError = useProgramError();
  const invalidate = useInvalidate();
  const [month, setMonth] = useState(currentMonth);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [episodeOpen, setEpisodeOpen] = useState(false);
  const [outcomeFor, setOutcomeFor] = useState<Episode | null>(null);
  const equipment = useQuery({ queryKey: ["oxygen", "equipment"], queryFn: () => apiFetch<{ data: Equipment[] }>("/api/v1/oxygen/equipment") });
  const episodes = useQuery({ queryKey: ["oxygen", "episodes", month], queryFn: () => apiFetch<{ data: Episode[] }>(`/api/v1/oxygen/episodes?month=${month}`) });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/v1/oxygen/equipment/${id}`, jsonInit("PATCH", { status })),
    onSuccess: invalidate,
    onError: (error) => toast.error(apiError(error)),
  });

  return (
    <div className="flex-1 overflow-y-auto space-y-6 p-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{t("equipment_title")}</h3>
          {canEdit && <Button size="sm" className="h-8 text-xs" onClick={() => setEquipmentOpen(true)}><Plus className="h-3.5 w-3.5" /> {t("new_equipment")}</Button>}
        </div>
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("code")}</th>
                <th className="px-3 py-2">{t("type")}</th>
                <th className="px-3 py-2">{t("label")}</th>
                <th className="px-3 py-2">{t("location")}</th>
                <th className="px-3 py-2">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipment.isLoading && <tr><td colSpan={5} className="px-3 py-4 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-slate-400" /></td></tr>}
              {equipment.data?.data.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center italic text-slate-400">{t("no_equipment")}</td></tr>}
              {equipment.data?.data.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-mono">{e.code}</td>
                  <td className="px-3 py-2">{t(`type_${e.type}`)}</td>
                  <td className="px-3 py-2">{e.label}</td>
                  <td className="px-3 py-2">{e.location ?? "—"}</td>
                  <td className="px-3 py-2">
                    <select value={e.status} disabled={!canEdit} onChange={(ev) => setStatus.mutate({ id: e.id, status: ev.target.value })} className={`${selectClass} w-36`}>
                      {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}`)}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t("episodes_title")}</h3>
            <EpiMonthPicker month={month} onChange={setMonth} />
          </div>
          {canEdit && <Button size="sm" className="h-8 text-xs" onClick={() => setEpisodeOpen(true)}><Plus className="h-3.5 w-3.5" /> {t("new_episode")}</Button>}
        </div>
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("patient")}</th>
                <th className="px-3 py-2">{t("detected_at")}</th>
                <th className="px-3 py-2">SpO2</th>
                <th className="px-3 py-2">{t("oxygen_given")}</th>
                <th className="px-3 py-2">{t("outcome")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {episodes.data?.data.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center italic text-slate-400">{t("no_episodes")}</td></tr>}
              {episodes.data?.data.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2">{e.patient.firstName} {e.patient.lastName}</td>
                  <td className="px-3 py-2">{format.dateTime(new Date(e.detectedAt), { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-3 py-2">{e.spo2 !== null ? `${e.spo2} %` : "—"}{e.respiratoryDistress ? ` · ${t("distress_short")}` : ""}</td>
                  <td className="px-3 py-2">{e.oxygenGiven ? t("yes") : t("no")}</td>
                  <td className="px-3 py-2">
                    {e.outcome ? t(`outcome_${e.outcome}`) : canEdit ? <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setOutcomeFor(e)}>{t("record_outcome")}</Button> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {equipmentOpen && <EquipmentDialog onClose={() => setEquipmentOpen(false)} />}
      {episodeOpen && <EpisodeDialog onClose={() => setEpisodeOpen(false)} />}
      {outcomeFor && <OutcomeDialog episode={outcomeFor} onClose={() => setOutcomeFor(null)} />}
    </div>
  );
}

function useSave<T>(url: string, method: string, onClose: () => void) {
  const apiError = useProgramError();
  const invalidate = useInvalidate();
  const t = useTranslations("programs");
  return useMutation({
    mutationFn: (body: T) => apiFetch(url, jsonInit(method, body)),
    onSuccess: () => {
      toast.success(t("saved"));
      invalidate();
      onClose();
    },
    onError: (error) => toast.error(apiError(error)),
  });
}

function EquipmentDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("programs.oxygen");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({ code: "", type: "pulse_oximeter", label: "", serialNumber: "", location: "", status: "functional" });
  const save = useSave<typeof form>("/api/v1/oxygen/equipment", "POST", onClose);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("new_equipment")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("code")}><Input value={form.code} maxLength={40} onChange={(e) => set({ code: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("type")}>
            <select value={form.type} onChange={(e) => set({ type: e.target.value })} className={selectClass}>
              {EQUIPMENT_TYPES.map((x) => <option key={x} value={x}>{t(`type_${x}`)}</option>)}
            </select>
          </Field>
          <Field label={t("label")} className="col-span-2"><Input value={form.label} maxLength={150} onChange={(e) => set({ label: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("serial_number")}><Input value={form.serialNumber} maxLength={80} onChange={(e) => set({ serialNumber: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("location")}><Input value={form.location} maxLength={150} onChange={(e) => set({ location: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={!form.code || !form.label || save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EpisodeDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("programs.oxygen");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({ patientId: "", detectedAt: today(), spo2: "", respiratoryDistress: false, deliveryRoom: false, oxygenGiven: false, notes: "" });
  const save = useSave<typeof form>("/api/v1/oxygen/episodes", "POST", onClose);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("new_episode")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("patient")} className="col-span-2"><PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => set({ patientId: p?.id ?? "" })} /></Field>
          <Field label={t("detected_at")}><Input type="date" value={form.detectedAt} max={today()} onChange={(e) => set({ detectedAt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="SpO2 (%)"><Input type="number" min={30} max={100} value={form.spo2} onChange={(e) => set({ spo2: e.target.value })} className="h-8 text-xs" /></Field>
          <Check label={t("respiratory_distress")} checked={form.respiratoryDistress} onChange={(v) => set({ respiratoryDistress: v })} />
          <Check label={t("delivery_room")} checked={form.deliveryRoom} onChange={(v) => set({ deliveryRoom: v })} />
          <Check label={t("oxygen_given")} checked={form.oxygenGiven} onChange={(v) => set({ oxygenGiven: v })} />
          <p className="col-span-2 text-[10px] text-slate-400">{t("episode_hint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={!form.patientId || save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeDialog({ episode, onClose }: { episode: Episode; onClose: () => void }) {
  const t = useTranslations("programs.oxygen");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({ outcome: "cured", outcomeAt: today(), oxygenGiven: episode.oxygenGiven });
  const save = useSave<typeof form>(`/api/v1/oxygen/episodes/${episode.id}`, "PATCH", onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t("record_outcome")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={t("outcome")}>
            <select value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} className={selectClass}>
              {HYPOXEMIA_OUTCOMES.map((o) => <option key={o} value={o}>{t(`outcome_${o}`)}</option>)}
            </select>
          </Field>
          <Field label={t("outcome_at")}><Input type="date" value={form.outcomeAt} max={today()} onChange={(e) => setForm((f) => ({ ...f, outcomeAt: e.target.value }))} className="h-8 text-xs" /></Field>
          <Check label={t("oxygen_given")} checked={form.oxygenGiven} onChange={(v) => setForm((f) => ({ ...f, oxygenGiven: v }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
