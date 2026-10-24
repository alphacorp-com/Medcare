"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SettingsList, SettingsListItem, SettingsPageHeader, SettingsPill, settingsActionButtonClass } from "@/components/settings/settings-ui";
import { Check, Field, jsonInit, selectClass } from "@/components/programs/form-bits";
import { COVERAGE_FAMILIES, dateInput, useCoverageError } from "@/components/coverage/shared";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Settings > Free-care programmes (gratuités): a share of the lines of some families paid by a
// programme, for patients matching age / sex / pregnancy criteria or enrolled one by one.

type Program = {
  id: string; code: string; name: string; rate: number; families: string[]; actCodes: string[]; inventoryItemIds: string[];
  eligibility: "automatic" | "enrolment"; minAgeMonths: number | null; maxAgeMonths: number | null; sex: "M" | "F" | null; pregnantOnly: boolean;
  validFrom: string | null; validTo: string | null; isActive: boolean; notes: string | null; _count: { enrolments: number };
};
type Article = { id: string; name: string };

const KEY = ["coverage", "programs"];

export default function ExemptionProgramsPage() {
  const t = useTranslations("coverage.programs");
  const tf = useTranslations("coverage.families");
  const [editing, setEditing] = useState<Program | "new" | null>(null);
  const programs = useQuery({ queryKey: KEY, queryFn: () => apiFetch<{ data: Program[] }>("/api/v1/coverage/programs") });
  const criteria = (p: Program) =>
    p.eligibility === "enrolment"
      ? t("enrolled_patients", { count: p._count.enrolments })
      : [
          p.minAgeMonths !== null || p.maxAgeMonths !== null ? t("age_range", { min: p.minAgeMonths ?? 0, max: p.maxAgeMonths ?? "∞" }) : null,
          p.sex ? t(`sex_${p.sex}`) : null,
          p.pregnantOnly ? t("pregnant_only") : null,
        ].filter(Boolean).join(" · ") || t("everyone");
  return (
    <div className="space-y-4">
      <SettingsPageHeader
        title={t("title")}
        description={t("description")}
        actions={<Button size="sm" className={cn("h-8 text-xs bg-blue-600 hover:bg-blue-700", settingsActionButtonClass)} onClick={() => setEditing("new")}><Plus className="mr-2 h-3.5 w-3.5" /> {t("new")}</Button>}
      />
      <SettingsList isLoading={programs.isPending} isEmpty={programs.data?.data.length === 0} emptyLabel={t("empty")}>
        {programs.data?.data.map((p) => (
          <SettingsListItem
            key={p.id}
            title={p.name}
            meta={<><span className="font-mono">{p.code}</span><span>{p.rate} %</span><span>{p.families.map((f) => tf(f)).join(", ")}</span><span>{criteria(p)}</span></>}
            badges={<>{!p.isActive && <SettingsPill>{t("inactive")}</SettingsPill>}<SettingsPill tone={p.eligibility === "automatic" ? "blue" : "emerald"}>{t(`eligibility_${p.eligibility}`)}</SettingsPill></>}
            actions={[{ label: t("edit"), icon: Pencil, onClick: () => setEditing(p) }]}
          />
        ))}
      </SettingsList>
      {editing && <ProgramDialog program={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProgramDialog({ program, onClose }: { program: Program | null; onClose: () => void }) {
  const t = useTranslations("coverage.programs");
  const tf = useTranslations("coverage.families");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const apiError = useCoverageError();
  // Pharmacy articles to restrict the programme to (needs the pharmacy module; optional).
  const articles = useQuery({ queryKey: ["pharmacy", "inventory"], queryFn: () => apiFetch<{ data: Article[] }>("/api/v1/pharmacy/inventory"), retry: false });
  const [form, setForm] = useState({
    code: program?.code ?? "", name: program?.name ?? "", rate: String(program?.rate ?? 100), families: program?.families ?? ["consultation"],
    actCodes: (program?.actCodes ?? []).join(", "), inventoryItemIds: program?.inventoryItemIds ?? [],
    eligibility: program?.eligibility ?? "automatic", minAgeMonths: program?.minAgeMonths?.toString() ?? "", maxAgeMonths: program?.maxAgeMonths?.toString() ?? "",
    sex: program?.sex ?? "", pregnantOnly: program?.pregnantOnly ?? false, validFrom: dateInput(program?.validFrom), validTo: dateInput(program?.validTo),
    isActive: program?.isActive ?? true, notes: program?.notes ?? "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const toggleFamily = (f: string) => set({ families: form.families.includes(f) ? form.families.filter((x) => x !== f) : [...form.families, f] });
  const save = useMutation({
    mutationFn: () => {
      const automatic = form.eligibility === "automatic";
      const body = {
        code: form.code, name: form.name, rate: Number(form.rate), families: form.families,
        actCodes: form.actCodes.split(",").map((c) => c.trim()).filter(Boolean), inventoryItemIds: form.inventoryItemIds, eligibility: form.eligibility,
        minAgeMonths: automatic && form.minAgeMonths !== "" ? Number(form.minAgeMonths) : null, maxAgeMonths: automatic && form.maxAgeMonths !== "" ? Number(form.maxAgeMonths) : null,
        sex: automatic ? form.sex || null : null, pregnantOnly: automatic && form.pregnantOnly,
        validFrom: form.validFrom || null, validTo: form.validTo || null, isActive: form.isActive, notes: form.notes || null,
      };
      return apiFetch(program ? `/api/v1/coverage/programs/${program.id}` : "/api/v1/coverage/programs", jsonInit(program ? "PATCH" : "POST", body));
    },
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: KEY });
      onClose();
    },
    onError: (error) => toast.error(apiError(error)),
  });
  const articleName = new Map((articles.data?.data ?? []).map((a) => [a.id, a.name]));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{program ? program.name : t("new")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t("code")}><Input value={form.code} maxLength={40} onChange={(e) => set({ code: e.target.value.toUpperCase() })} className="h-8 font-mono text-xs" /></Field>
          <Field label={t("name")} className="col-span-2"><Input value={form.name} maxLength={150} onChange={(e) => set({ name: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={`${t("rate")} (%)`}><Input type="number" min={1} max={100} value={form.rate} onChange={(e) => set({ rate: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-[10px] font-bold uppercase text-slate-500">{t("families")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COVERAGE_FAMILIES.map((f) => <Check key={f} label={tf(f)} checked={form.families.includes(f)} onChange={() => toggleFamily(f)} />)}
          </div>
        </fieldset>
        <Field label={t("act_codes")}><Input value={form.actCodes} placeholder="TDR, GE, CONS_PEDIATRIE" onChange={(e) => set({ actCodes: e.target.value })} className="h-8 text-xs" /></Field>
        <p className="-mt-2 text-[11px] text-slate-400">{t("act_codes_hint")}</p>
        {form.families.includes("pharmacy") && (
          <Field label={t("articles")}>
            <div className="space-y-1">
              <select value="" onChange={(e) => e.target.value && set({ inventoryItemIds: [...new Set([...form.inventoryItemIds, e.target.value])] })} className={selectClass} disabled={!articles.data}>
                <option value="">{articles.isError ? t("articles_unavailable") : t("add_article")}</option>
                {articles.data?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div className="flex flex-wrap gap-1">
                {form.inventoryItemIds.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px]">
                    {articleName.get(id) ?? id.slice(0, 8)}
                    <button type="button" onClick={() => set({ inventoryItemIds: form.inventoryItemIds.filter((x) => x !== id) })}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          </Field>
        )}
        <Field label={t("eligibility")}>
          <select value={form.eligibility} onChange={(e) => set({ eligibility: e.target.value as Program["eligibility"] })} className={selectClass}>
            <option value="automatic">{t("eligibility_automatic")}</option>
            <option value="enrolment">{t("eligibility_enrolment")}</option>
          </select>
        </Field>
        {form.eligibility === "automatic" ? (
          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
            <Field label={t("min_age_months")}><Input type="number" min={0} value={form.minAgeMonths} onChange={(e) => set({ minAgeMonths: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label={t("max_age_months")}><Input type="number" min={1} value={form.maxAgeMonths} onChange={(e) => set({ maxAgeMonths: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label={t("sex")}>
              <select value={form.sex} onChange={(e) => set({ sex: e.target.value as "" | "M" | "F" })} className={selectClass}>
                <option value="">{t("everyone")}</option>
                <option value="F">{t("sex_F")}</option>
                <option value="M">{t("sex_M")}</option>
              </select>
            </Field>
            <Check label={t("pregnant_only")} checked={form.pregnantOnly} onChange={(v) => set({ pregnantOnly: v })} />
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">{t("enrolment_hint")}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("valid_from")}><Input type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("valid_to")}><Input type="date" value={form.validTo} onChange={(e) => set({ validTo: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <Field label={t("notes")}><Input value={form.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} className="h-8 text-xs" /></Field>
        <Check label={t("active")} checked={form.isActive} onChange={(v) => set({ isActive: v })} />
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" disabled={!form.code || !form.name || form.families.length === 0 || save.isPending} onClick={() => save.mutate()}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
