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
import { EpiMonthPicker, currentMonth } from "./epi-shared";

// RMA3 IV.3 complements: active TB case finding (screening register) and the TB case
// complements (TB-RR, second line, cotrimoxazole, health worker).

type Screening = {
  id: string;
  screenedAt: string;
  presumptive: boolean;
  sentToLabAt: string | null;
  testedAt: string | null;
  testPositive: boolean | null;
  tptStartedAt: string | null;
  patient: { firstName: string; lastName: string; ipp: string };
};

export type TbCaseComplementsItem = {
  id: string;
  rifampicinResistant?: boolean;
  secondLineStartedAt?: string | null;
  cotrimoxazole?: boolean;
  isHealthWorker?: boolean;
};

const day = (iso: string | null) => iso?.slice(0, 10) ?? "";

function useSave<T>(url: string, method: string, onDone: () => void, queryKey: string[]) {
  const queryClient = useQueryClient();
  const apiError = useProgramError();
  const t = useTranslations("programs");
  return useMutation({
    mutationFn: (body: T) => apiFetch(url, jsonInit(method, body)),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey });
      onDone();
    },
    onError: (error) => toast.error(apiError(error)),
  });
}

export function TbScreeningPanel({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("programs.tb");
  const format = useFormatter();
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState<Screening | "new" | null>(null);
  const screenings = useQuery({ queryKey: ["tb-screenings", month], queryFn: () => apiFetch<{ data: Screening[] }>(`/api/v1/tb-screenings?month=${month}`) });
  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "—");
  return (
    <section className="space-y-2 border-t border-slate-200 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{t("screening_title")}</h3>
          <EpiMonthPicker month={month} onChange={setMonth} />
        </div>
        {canEdit && <Button size="sm" className="h-8 text-xs" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" /> {t("new_screening")}</Button>}
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("patient")}</th>
              <th className="px-3 py-2">{t("screened_at")}</th>
              <th className="px-3 py-2">{t("presumptive")}</th>
              <th className="px-3 py-2">{t("sent_to_lab")}</th>
              <th className="px-3 py-2">{t("tested")}</th>
              <th className="px-3 py-2">{t("tpt")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {screenings.data?.data.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center italic text-slate-400">{t("no_screenings")}</td></tr>}
            {screenings.data?.data.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">{s.patient.firstName} {s.patient.lastName}</td>
                <td className="px-3 py-2">{date(s.screenedAt)}</td>
                <td className="px-3 py-2">{s.presumptive ? t("yes") : t("no")}</td>
                <td className="px-3 py-2">{date(s.sentToLabAt)}</td>
                <td className="px-3 py-2">{date(s.testedAt)}{s.testPositive === null ? "" : s.testPositive ? " (+)" : " (−)"}</td>
                <td className="px-3 py-2">{date(s.tptStartedAt)}</td>
                <td className="px-3 py-2 text-right">{canEdit && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditing(s)}>{t("follow_up")}</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <ScreeningDialog screening={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ScreeningDialog({ screening, onClose }: { screening: Screening | null; onClose: () => void }) {
  const t = useTranslations("programs.tb");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({
    patientId: "",
    screenedAt: screening ? day(screening.screenedAt) : today(),
    presumptive: screening?.presumptive ?? false,
    sentToLabAt: day(screening?.sentToLabAt ?? null),
    testedAt: day(screening?.testedAt ?? null),
    testPositive: screening?.testPositive ?? null,
    tptStartedAt: day(screening?.tptStartedAt ?? null),
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave<Record<string, unknown>>(screening ? `/api/v1/tb-screenings/${screening.id}` : "/api/v1/tb-screenings", screening ? "PATCH" : "POST", onClose, ["tb-screenings"]);
  const body = () => {
    const { patientId, ...rest } = form;
    return screening ? rest : { patientId, ...rest };
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{screening ? t("follow_up") : t("new_screening")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {!screening && <Field label={t("patient")} className="col-span-2"><PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => set({ patientId: p?.id ?? "" })} /></Field>}
          <Field label={t("screened_at")}><Input type="date" value={form.screenedAt} max={today()} disabled={Boolean(screening)} onChange={(e) => set({ screenedAt: e.target.value })} className="h-8 text-xs" /></Field>
          <div className="flex items-end"><Check label={t("presumptive")} checked={form.presumptive} onChange={(v) => set({ presumptive: v })} /></div>
          <Field label={t("sent_to_lab")}><Input type="date" value={form.sentToLabAt} max={today()} onChange={(e) => set({ sentToLabAt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("tested")}><Input type="date" value={form.testedAt} max={today()} onChange={(e) => set({ testedAt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("result")}>
            <select value={form.testPositive === null ? "" : form.testPositive ? "positive" : "negative"} onChange={(e) => set({ testPositive: e.target.value === "" ? null : e.target.value === "positive" })} className={selectClass}>
              <option value="">—</option>
              <option value="negative">{t("negative")}</option>
              <option value="positive">{t("positive")}</option>
            </select>
          </Field>
          <Field label={t("tpt")}><Input type="date" value={form.tptStartedAt} max={today()} onChange={(e) => set({ tptStartedAt: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={(!screening && !form.patientId) || save.isPending} onClick={() => save.mutate(body())}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TbCaseComplementsDialog({ tbCase, onClose, onSaved }: { tbCase: TbCaseComplementsItem; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("programs.tb");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({
    rifampicinResistant: tbCase.rifampicinResistant ?? false,
    secondLineStartedAt: day(tbCase.secondLineStartedAt ?? null),
    cotrimoxazole: tbCase.cotrimoxazole ?? false,
    isHealthWorker: tbCase.isHealthWorker ?? false,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave<typeof form>(`/api/v1/tb-cases/${tbCase.id}`, "PATCH", () => {
    onSaved();
    onClose();
  }, ["tb-cases"]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t("case_complements")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Check label={t("rifampicin_resistant")} checked={form.rifampicinResistant} onChange={(v) => set({ rifampicinResistant: v })} />
          {form.rifampicinResistant && (
            <Field label={t("second_line_started")}><Input type="date" value={form.secondLineStartedAt} max={today()} onChange={(e) => set({ secondLineStartedAt: e.target.value })} className="h-8 text-xs" /></Field>
          )}
          <Check label={t("cotrimoxazole")} checked={form.cotrimoxazole} onChange={(v) => set({ cotrimoxazole: v })} />
          <Check label={t("health_worker")} checked={form.isHealthWorker} onChange={(v) => set({ isHealthWorker: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ ...form, secondLineStartedAt: form.rifampicinResistant ? form.secondLineStartedAt : "" })}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
