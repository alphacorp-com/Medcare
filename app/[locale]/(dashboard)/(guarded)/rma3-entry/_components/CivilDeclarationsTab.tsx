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
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";
import { previousMonth, selectClass, useRma3ApiError } from "./shared";

// Birth / death declarations transmitted to the civil registry (RMA3 V.2).

type Declaration = { id: string; type: "birth" | "death"; personName: string; eventDate: string; transmittedAt: string; reference: string | null };

const today = () => new Date().toISOString().slice(0, 10);

export function CivilDeclarationsTab() {
  const t = useTranslations("rma3Entry.civil");
  const format = useFormatter();
  const canEdit = useAppStore((state) => state.hasPermission("MODULE_RMA3", "update"));
  const [month, setMonth] = useState(previousMonth);
  const [creating, setCreating] = useState(false);
  const declarations = useQuery({
    queryKey: ["rma3-entry", "civil", month],
    queryFn: () => apiFetch<{ data: Declaration[] }>(`/api/v1/rma3-entry/civil-declarations?month=${month}`),
  });
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short" });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label className="space-y-1 text-[10px] font-bold uppercase text-slate-500">
          <span className="block">{t("month")}</span>
          <Input type="month" value={month} max={today().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-40 text-xs" />
        </label>
        {canEdit && <Button size="sm" className="h-8 text-xs" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> {t("new")}</Button>}
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("type")}</th>
              <th className="px-3 py-2">{t("person")}</th>
              <th className="px-3 py-2">{t("event_date")}</th>
              <th className="px-3 py-2">{t("transmitted_at")}</th>
              <th className="px-3 py-2">{t("reference")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {declarations.data?.data.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center italic text-slate-400">{t("empty")}</td></tr>}
            {declarations.data?.data.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2">{t(`type_${d.type}`)}</td>
                <td className="px-3 py-2">{d.personName}</td>
                <td className="px-3 py-2">{date(d.eventDate)}</td>
                <td className="px-3 py-2">{date(d.transmittedAt)}</td>
                <td className="px-3 py-2">{d.reference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <DeclarationDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function DeclarationDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("rma3Entry.civil");
  const tc = useTranslations("common");
  const apiError = useRma3ApiError();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ type: "birth" as Declaration["type"], patientId: "", personName: "", eventDate: "", transmittedAt: today(), reference: "" });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useMutation({
    mutationFn: () => apiFetch("/api/v1/rma3-entry/civil-declarations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["rma3-entry", "civil"] });
      onClose();
    },
    onError: (error) => toast.error(apiError(error)),
  });
  const field = "space-y-1 text-[10px] font-bold uppercase text-slate-500";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("new")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            <span className="block">{t("type")}</span>
            <select value={form.type} onChange={(e) => set({ type: e.target.value as Declaration["type"] })} className={`${selectClass} w-full`}>
              <option value="birth">{t("type_birth")}</option>
              <option value="death">{t("type_death")}</option>
            </select>
          </label>
          <label className={field}>
            <span className="block">{t("reference")}</span>
            <Input value={form.reference} maxLength={80} onChange={(e) => set({ reference: e.target.value })} className="h-8 text-xs" />
          </label>
          <div className={`${field} col-span-2`}>
            <span className="block">{t("patient_optional")}</span>
            <PatientSearchAutocomplete
              className="h-8 text-xs"
              onSelect={(p) => set({ patientId: p?.id ?? "", personName: p ? `${p.firstName} ${p.lastName}` : form.personName })}
            />
          </div>
          <label className={`${field} col-span-2`}>
            <span className="block">{t("person")}</span>
            <Input value={form.personName} maxLength={150} onChange={(e) => set({ personName: e.target.value })} className="h-8 text-xs" />
          </label>
          <label className={field}>
            <span className="block">{t("event_date")}</span>
            <Input type="date" value={form.eventDate} max={today()} onChange={(e) => set({ eventDate: e.target.value })} className="h-8 text-xs" />
          </label>
          <label className={field}>
            <span className="block">{t("transmitted_at")}</span>
            <Input type="date" value={form.transmittedAt} max={today()} onChange={(e) => set({ transmittedAt: e.target.value })} className="h-8 text-xs" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={!form.personName.trim() || !form.eventDate || save.isPending} onClick={() => save.mutate()}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
