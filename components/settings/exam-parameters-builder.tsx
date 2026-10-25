"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ExamParameterDefinition } from "@/lib/exam-catalog/parameters";
import {
  blankDraft,
  draftsFromDefinitions,
  duplicateDraft,
  moveDraft,
  type OptionFlag,
  type ParameterDraft,
  type ParameterKind,
  type SexDraft,
} from "@/lib/exam-catalog/parameter-drafts";
import { ExamParametersEditor, rowsFromDefinitions, type ParameterRow } from "@/components/shared/exam-parameters-editor";
import { useConfirm } from "@/components/providers/confirm-provider";

const KINDS: ParameterKind[] = ["numeric", "qualitative", "text"];
const NEXT_FLAG: Record<OptionFlag, OptionFlag> = { normal: "abnormal", abnormal: "critical", critical: "normal" };
const FLAG_CLASS: Record<OptionFlag, string> = {
  normal: "border-green-200 bg-green-50 text-green-800",
  abnormal: "border-orange-200 bg-orange-50 text-orange-800",
  critical: "border-red-300 bg-red-50 text-red-700",
};

interface BuilderProps {
  drafts: ParameterDraft[];
  onChange: (drafts: ParameterDraft[]) => void;
  // Standard sheets offered as starting points (lib/exam-catalog/standard-parameters.ts).
  standardSheets: Record<string, ExamParameterDefinition[]>;
  // Row flagged by validation, highlighted and scrolled into view.
  errorIndex?: number;
}

// Editor of an exam's result sheet (ExamCatalogEntry.parameters): one card per parameter,
// typed as numeric (bounds → automatic low/high/critical flags), qualitative (a list of
// answers, each yielding a flag) or free text. The server re-validates whatever is saved.
export function ExamParametersBuilder({ drafts, onChange, standardSheets, errorIndex }: BuilderProps) {
  const t = useTranslations("settings.examTypes");
  const confirm = useConfirm();
  const sections = [...new Set(drafts.map((d) => d.section.trim()).filter(Boolean))];

  const update = (index: number, patch: Partial<ParameterDraft>) =>
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const loadStandard = async (code: string) => {
    const sheet = standardSheets[code];
    if (!sheet) return;
    if (drafts.length > 0 && !(await confirm({ message: t("load_standard_confirm", { count: drafts.length, code }) }))) return;
    onChange(draftsFromDefinitions(sheet));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{t("params_count", { count: drafts.length })}</span>
        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(standardSheets).length > 0 && (
            <select
              value=""
              onChange={(e) => loadStandard(e.target.value)}
              aria-label={t("load_standard")}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
            >
              <option value="">{t("load_standard")}</option>
              {Object.entries(standardSheets).map(([code, sheet]) => (
                <option key={code} value={code}>
                  {code} — {t("params_count", { count: sheet.length })}
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onChange([...drafts, blankDraft("numeric", drafts.at(-1)?.section ?? "")])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> {t("add_parameter")}
          </Button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
          {t("params_empty")}
        </p>
      ) : (
        <ol className="space-y-2">
          {drafts.map((draft, index) => (
            <ParameterCard
              key={draft.key}
              draft={draft}
              index={index}
              count={drafts.length}
              hasError={errorIndex === index}
              sectionListId="exam-param-sections"
              onUpdate={(patch) => update(index, patch)}
              onMove={(offset) => onChange(moveDraft(drafts, index, offset))}
              onDuplicate={() => onChange(duplicateDraft(drafts, index))}
              onRemove={() => onChange(drafts.filter((_, i) => i !== index))}
            />
          ))}
        </ol>
      )}

      <datalist id="exam-param-sections">
        {sections.map((section) => <option key={section} value={section} />)}
      </datalist>
    </div>
  );
}

function ParameterCard({
  draft, index, count, hasError, sectionListId, onUpdate, onMove, onDuplicate, onRemove,
}: {
  draft: ParameterDraft;
  index: number;
  count: number;
  hasError: boolean;
  sectionListId: string;
  onUpdate: (patch: Partial<ParameterDraft>) => void;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("settings.examTypes");
  const ref = useRef<HTMLLIElement>(null);

  // Bring a rejected row into view (DOM side effect only, no state).
  useEffect(() => {
    if (hasError) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hasError]);

  const iconButton = "rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <li
      ref={ref}
      className={cn(
        "rounded-lg border bg-white p-3 space-y-3",
        hasError ? "border-red-300 ring-2 ring-red-100" : "border-slate-200"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
          {index + 1}
        </span>
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label={t("param_kind")}>
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={draft.kind === kind}
              onClick={() => onUpdate({ kind })}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium",
                draft.kind === kind ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t(`param_kind_${kind}`)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" className={iconButton} disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("move_up")} title={t("move_up")}>
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconButton} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t("move_down")} title={t("move_down")}>
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconButton} onClick={onDuplicate} aria-label={t("duplicate")} title={t("duplicate")}>
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={cn(iconButton, "hover:text-red-600")} onClick={onRemove} aria-label={t("remove")} title={t("remove")}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-2">
        <Field label={t("param_section")}>
          <Input
            value={draft.section}
            list={sectionListId}
            maxLength={80}
            placeholder={t("param_section_placeholder")}
            onChange={(e) => onUpdate({ section: e.target.value })}
            className="h-8 text-xs"
          />
        </Field>
        <Field label={`${t("param_name")} *`}>
          <Input
            value={draft.name}
            maxLength={120}
            required
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="h-8 text-xs"
          />
        </Field>
      </div>

      {draft.kind === "numeric" && <NumericFields draft={draft} onUpdate={onUpdate} />}
      {draft.kind === "qualitative" && <QualitativeFields draft={draft} onUpdate={onUpdate} />}
      {draft.kind === "text" && (
        <div className="grid grid-cols-1 sm:grid-cols-[0.6fr_1.4fr] gap-2">
          <Field label={t("param_unit")}>
            <Input value={draft.unit} maxLength={40} onChange={(e) => onUpdate({ unit: e.target.value })} className="h-8 text-xs" />
          </Field>
          <Field label={t("param_reference")}>
            <Input
              value={draft.referenceRange}
              maxLength={160}
              placeholder={t("param_reference_text_placeholder")}
              onChange={(e) => onUpdate({ referenceRange: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs font-mono" />
    </Field>
  );
}

function NumericFields({ draft, onUpdate }: { draft: ParameterDraft; onUpdate: (patch: Partial<ParameterDraft>) => void }) {
  const t = useTranslations("settings.examTypes");
  const updateSex = (sex: "male" | "female", patch: Partial<SexDraft>) => onUpdate({ [sex]: { ...draft[sex], ...patch } });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[0.6fr_1.4fr] gap-2">
        <Field label={t("param_unit")}>
          <Input value={draft.unit} maxLength={40} placeholder="g/dL" onChange={(e) => onUpdate({ unit: e.target.value })} className="h-8 text-xs" />
        </Field>
        <Field label={t("param_reference")}>
          <Input
            value={draft.referenceRange}
            maxLength={160}
            placeholder={t("param_reference_placeholder")}
            onChange={(e) => onUpdate({ referenceRange: e.target.value })}
            className="h-8 text-xs"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <NumberInput label={t("param_low")} value={draft.low} onChange={(low) => onUpdate({ low })} />
        <NumberInput label={t("param_high")} value={draft.high} onChange={(high) => onUpdate({ high })} />
        <NumberInput label={t("param_critical_low")} value={draft.criticalLow} onChange={(criticalLow) => onUpdate({ criticalLow })} />
        <NumberInput label={t("param_critical_high")} value={draft.criticalHigh} onChange={(criticalHigh) => onUpdate({ criticalHigh })} />
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.bySexEnabled}
          onChange={(e) => onUpdate({ bySexEnabled: e.target.checked })}
          className="rounded border-slate-300 text-blue-600"
        />
        {t("param_by_sex")}
      </label>
      {draft.bySexEnabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md bg-slate-50 p-2">
          {(["male", "female"] as const).map((sex) => (
            <div key={sex} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600">{t(`param_${sex}`)}</p>
              <Input
                aria-label={`${t(`param_${sex}`)} — ${t("param_reference")}`}
                value={draft[sex].referenceRange}
                maxLength={160}
                placeholder={t("param_reference")}
                onChange={(e) => updateSex(sex, { referenceRange: e.target.value })}
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label={t("param_low")} value={draft[sex].low} onChange={(low) => updateSex(sex, { low })} />
                <NumberInput label={t("param_high")} value={draft[sex].high} onChange={(high) => updateSex(sex, { high })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QualitativeFields({ draft, onUpdate }: { draft: ParameterDraft; onUpdate: (patch: Partial<ParameterDraft>) => void }) {
  const t = useTranslations("settings.examTypes");
  const [pending, setPending] = useState("");

  const addOption = () => {
    const value = pending.trim();
    if (!value || draft.options.some((o) => o.value === value)) return;
    // The first answer is usually the normal one ("Négatif").
    onUpdate({ options: [...draft.options, { value, flag: draft.options.length === 0 ? "normal" : "abnormal" }] });
    setPending("");
  };

  return (
    <div className="space-y-2">
      <Field label={t("param_reference")}>
        <Input
          value={draft.referenceRange}
          maxLength={160}
          placeholder={t("param_reference_text_placeholder")}
          onChange={(e) => onUpdate({ referenceRange: e.target.value })}
          className="h-8 text-xs"
        />
      </Field>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-500">{t("param_options")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {draft.options.map((option, i) => (
            <span key={option.value} className={cn("inline-flex items-center rounded-full border text-xs", FLAG_CLASS[option.flag])}>
              <button
                type="button"
                className="py-0.5 pl-2.5 pr-1"
                title={t("param_option_hint")}
                onClick={() =>
                  onUpdate({ options: draft.options.map((o, j) => (j === i ? { ...o, flag: NEXT_FLAG[o.flag] } : o)) })
                }
              >
                {option.value} · <span className="font-semibold">{t(`param_option_flag_${option.flag}`)}</span>
              </button>
              <button
                type="button"
                aria-label={t("remove")}
                className="py-0.5 pr-2 pl-0.5 opacity-60 hover:opacity-100"
                onClick={() => onUpdate({ options: draft.options.filter((_, j) => j !== i) })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={pending}
            maxLength={60}
            placeholder={t("param_option_add_placeholder")}
            onChange={(e) => setPending(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // don't submit the exam form
                addOption();
              }
            }}
            className="h-8 text-xs"
          />
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addOption} disabled={!pending.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {draft.options.length > 0 && <p className="text-[11px] text-slate-400">{t("param_option_hint")}</p>}
      </div>
    </div>
  );
}

// Live rendering of the technician's entry form for the sheet being edited, with the real
// automatic flags. Nothing typed here is saved.
export function ExamParametersPreview({ definitions }: { definitions: ExamParameterDefinition[] }) {
  const t = useTranslations("settings.examTypes");
  const [gender, setGender] = useState<"M" | "F">("F");
  const [rows, setRows] = useState<ParameterRow[]>(() => rowsFromDefinitions(definitions, "F"));

  const switchGender = (next: "M" | "F") => {
    setGender(next);
    setRows(rowsFromDefinitions(definitions, next));
  };

  if (definitions.length === 0) {
    return <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">{t("params_empty")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">{t("preview_hint")}</p>
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label={t("preview_sex")}>
          {(["F", "M"] as const).map((sex) => (
            <button
              key={sex}
              type="button"
              aria-pressed={gender === sex}
              onClick={() => switchGender(sex)}
              className={cn("rounded px-2 py-0.5 text-[11px] font-medium", gender === sex ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}
            >
              {t(sex === "M" ? "param_male" : "param_female")}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <ExamParametersEditor rows={rows} onChange={setRows} gender={gender} />
      </div>
    </div>
  );
}
