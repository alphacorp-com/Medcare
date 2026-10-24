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
import { Check, Field, YesNo, jsonInit, selectClass, today } from "@/components/programs/form-bits";
import { useProgramError } from "@/components/programs/use-program-error";
import { apiFetch } from "@/lib/api-client";
import { NUTRITION_ADMISSIONS, NUTRITION_CRITERIA, NUTRITION_EXITS, NUTRITION_PROGRAMS, NUTRITION_RESIDENCIES } from "@/lib/programs/input";
import { EpiMonthPicker, currentMonth } from "./epi-shared";

// RMA3 IV.6 (acute malnutrition, PCIMA) and III.9 (growth monitoring / infant feeding).

type PatientRef = { id: string; firstName: string; lastName: string; ipp: string };
type NutritionCase = {
  id: string;
  program: string;
  admittedAt: string;
  admissionType: string;
  criterion: string | null;
  residency: string;
  hivTested: boolean;
  anjeCounseling: boolean;
  exitedAt: string | null;
  exitReason: string | null;
  patient: PatientRef;
};
type GrowthVisit = {
  id: string;
  visitDate: string;
  weightKg: string | null;
  heightCm: string | null;
  muacMm: number | null;
  multivitaminGiven: boolean;
  patient: PatientRef;
};

export function NutritionTab({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("programs.nutrition");
  const format = useFormatter();
  const [activeOnly, setActiveOnly] = useState(true);
  const [month, setMonth] = useState(currentMonth);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [exitCase, setExitCase] = useState<NutritionCase | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const cases = useQuery({ queryKey: ["nutrition", "cases", activeOnly], queryFn: () => apiFetch<{ data: NutritionCase[] }>(`/api/v1/nutrition/cases?active=${activeOnly}`) });
  const visits = useQuery({ queryKey: ["nutrition", "growth", month], queryFn: () => apiFetch<{ data: GrowthVisit[] }>(`/api/v1/nutrition/growth-visits?month=${month}`) });
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <div className="flex-1 overflow-y-auto space-y-6 p-4">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{t("pcima_title")}</h3>
          <div className="flex items-center gap-3">
            <Check label={t("active_only")} checked={activeOnly} onChange={setActiveOnly} />
            {canEdit && (
              <Button size="sm" className="h-8 text-xs" onClick={() => setAdmitOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> {t("new_admission")}
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("patient")}</th>
                <th className="px-3 py-2">{t("program")}</th>
                <th className="px-3 py-2">{t("admitted_at")}</th>
                <th className="px-3 py-2">{t("admission_type")}</th>
                <th className="px-3 py-2">{t("status")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.isLoading && <tr><td colSpan={6} className="px-3 py-4 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-slate-400" /></td></tr>}
              {cases.data?.data.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center italic text-slate-400">{t("no_cases")}</td></tr>}
              {cases.data?.data.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">{c.patient.firstName} {c.patient.lastName} <span className="font-mono text-[10px] text-slate-400">{c.patient.ipp}</span></td>
                  <td className="px-3 py-2 uppercase">{c.program}</td>
                  <td className="px-3 py-2">{date(c.admittedAt)}</td>
                  <td className="px-3 py-2">{t(`admission_${c.admissionType}`)}</td>
                  <td className="px-3 py-2">{c.exitReason ? `${t(`exit_${c.exitReason}`)} (${date(c.exitedAt!)})` : t("in_care")}</td>
                  <td className="px-3 py-2 text-right">
                    {canEdit && !c.exitedAt && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setExitCase(c)}>{t("record_exit")}</Button>
                    )}
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
            <h3 className="text-sm font-semibold text-slate-800">{t("growth_title")}</h3>
            <EpiMonthPicker month={month} onChange={setMonth} />
          </div>
          {canEdit && (
            <Button size="sm" className="h-8 text-xs" onClick={() => setVisitOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> {t("new_growth_visit")}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("patient")}</th>
                <th className="px-3 py-2">{t("visit_date")}</th>
                <th className="px-3 py-2">{t("weight")}</th>
                <th className="px-3 py-2">{t("height")}</th>
                <th className="px-3 py-2">{t("muac")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visits.data?.data.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center italic text-slate-400">{t("no_visits")}</td></tr>}
              {visits.data?.data.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2">{v.patient.firstName} {v.patient.lastName}</td>
                  <td className="px-3 py-2">{date(v.visitDate)}</td>
                  <td className="px-3 py-2">{v.weightKg ?? "—"}</td>
                  <td className="px-3 py-2">{v.heightCm ?? "—"}</td>
                  <td className="px-3 py-2">{v.muacMm ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {admitOpen && <AdmissionDialog onClose={() => setAdmitOpen(false)} />}
      {exitCase && <ExitDialog nutritionCase={exitCase} onClose={() => setExitCase(null)} />}
      {visitOpen && <GrowthVisitDialog onClose={() => setVisitOpen(false)} />}
    </div>
  );
}

function useSave<T>(url: string, method: string, onClose: () => void) {
  const queryClient = useQueryClient();
  const apiError = useProgramError();
  const t = useTranslations("programs");
  return useMutation({
    mutationFn: (body: T) => apiFetch(url, jsonInit(method, body)),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["nutrition"] });
      onClose();
    },
    onError: (error) => toast.error(apiError(error)),
  });
}

function AdmissionDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("programs.nutrition");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({
    patientId: "",
    program: "cna",
    admittedAt: today(),
    admissionType: "new_case",
    criterion: "",
    muacMm: "",
    whz: "",
    residency: "resident",
    hivTested: false,
    anjeCounseling: false,
  });
  const save = useSave<typeof form>("/api/v1/nutrition/cases", "POST", onClose);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("new_admission")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("patient")} className="col-span-2"><PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => set({ patientId: p?.id ?? "" })} /></Field>
          <Field label={t("program")}>
            <select value={form.program} onChange={(e) => set({ program: e.target.value })} className={selectClass}>
              {NUTRITION_PROGRAMS.map((p) => <option key={p} value={p}>{t(`program_${p}`)}</option>)}
            </select>
          </Field>
          <Field label={t("admitted_at")}><Input type="date" value={form.admittedAt} max={today()} onChange={(e) => set({ admittedAt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("admission_type")}>
            <select value={form.admissionType} onChange={(e) => set({ admissionType: e.target.value })} className={selectClass}>
              {NUTRITION_ADMISSIONS.map((a) => <option key={a} value={a}>{t(`admission_${a}`)}</option>)}
            </select>
          </Field>
          <Field label={t("criterion")}>
            <select value={form.criterion} onChange={(e) => set({ criterion: e.target.value })} className={selectClass}>
              <option value="">—</option>
              {NUTRITION_CRITERIA.map((c) => <option key={c} value={c}>{t(`criterion_${c}`)}</option>)}
            </select>
          </Field>
          <Field label={t("muac")}><Input type="number" value={form.muacMm} onChange={(e) => set({ muacMm: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("whz")}><Input type="number" step="0.1" value={form.whz} onChange={(e) => set({ whz: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("residency")} className="col-span-2">
            <select value={form.residency} onChange={(e) => set({ residency: e.target.value })} className={selectClass}>
              {NUTRITION_RESIDENCIES.map((r) => <option key={r} value={r}>{t(`residency_${r}`)}</option>)}
            </select>
          </Field>
          <Check label={t("hiv_tested")} checked={form.hivTested} onChange={(v) => set({ hivTested: v })} />
          <Check label={t("anje_counseling")} checked={form.anjeCounseling} onChange={(v) => set({ anjeCounseling: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={!form.patientId || save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExitDialog({ nutritionCase, onClose }: { nutritionCase: NutritionCase; onClose: () => void }) {
  const t = useTranslations("programs.nutrition");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({ exitReason: "cured", exitedAt: today(), hivTested: nutritionCase.hivTested, anjeCounseling: nutritionCase.anjeCounseling });
  const save = useSave<typeof form>(`/api/v1/nutrition/cases/${nutritionCase.id}`, "PATCH", onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t("record_exit")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={t("exit_reason")}>
            <select value={form.exitReason} onChange={(e) => setForm((f) => ({ ...f, exitReason: e.target.value }))} className={selectClass}>
              {NUTRITION_EXITS.map((x) => <option key={x} value={x}>{t(`exit_${x}`)}</option>)}
            </select>
          </Field>
          <Field label={t("exited_at")}><Input type="date" value={form.exitedAt} max={today()} onChange={(e) => setForm((f) => ({ ...f, exitedAt: e.target.value }))} className="h-8 text-xs" /></Field>
          <Check label={t("hiv_tested")} checked={form.hivTested} onChange={(v) => setForm((f) => ({ ...f, hivTested: v }))} />
          <Check label={t("anje_counseling")} checked={form.anjeCounseling} onChange={(v) => setForm((f) => ({ ...f, anjeCounseling: v }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrowthVisitDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("programs.nutrition");
  const tp = useTranslations("programs");
  const [form, setForm] = useState({
    patientId: "",
    visitDate: today(),
    weightKg: "",
    heightCm: "",
    muacMm: "",
    counseling: false,
    exclusiveBreastfeeding: null as boolean | null,
    receivesWater: null as boolean | null,
    complementaryFood: null as boolean | null,
    stillBreastfed: null as boolean | null,
    multivitaminGiven: false,
  });
  const save = useSave<typeof form>("/api/v1/nutrition/growth-visits", "POST", onClose);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("new_growth_visit")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("patient")} className="col-span-2"><PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => set({ patientId: p?.id ?? "" })} /></Field>
          <Field label={t("visit_date")}><Input type="date" value={form.visitDate} max={today()} onChange={(e) => set({ visitDate: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("weight")}><Input type="number" step="0.01" value={form.weightKg} onChange={(e) => set({ weightKg: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("height")}><Input type="number" step="0.1" value={form.heightCm} onChange={(e) => set({ heightCm: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("muac")}><Input type="number" value={form.muacMm} onChange={(e) => set({ muacMm: e.target.value })} className="h-8 text-xs" /></Field>
          <YesNo label={t("exclusive_breastfeeding")} value={form.exclusiveBreastfeeding} onChange={(v) => set({ exclusiveBreastfeeding: v })} />
          <YesNo label={t("receives_water")} value={form.receivesWater} onChange={(v) => set({ receivesWater: v })} />
          <YesNo label={t("complementary_food")} value={form.complementaryFood} onChange={(v) => set({ complementaryFood: v })} />
          <YesNo label={t("still_breastfed")} value={form.stillBreastfed} onChange={(v) => set({ stillBreastfed: v })} />
          <Check label={t("counseling")} checked={form.counseling} onChange={(v) => set({ counseling: v })} />
          <Check label={t("multivitamin")} checked={form.multivitaminGiven} onChange={(v) => set({ multivitaminGiven: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={!form.patientId || save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
