"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ResultFlag, ResultParameter } from "@/lib/laboratory/results";
import { deriveFlag, resolveReference, type ExamParameterDefinition } from "@/lib/exam-catalog/parameters";

const FLAGS: ResultFlag[] = ["normal", "low", "high", "abnormal", "critical"];

// A result row plus the catalog definition it came from (absent for rows the technician
// added by hand) and whether the flag was set by hand — a hand-set flag is never
// overwritten by the automatic one.
export type ParameterRow = ResultParameter & { def?: ExamParameterDefinition; flagTouched?: boolean };

export function rowsFromDefinitions(definitions: ExamParameterDefinition[], gender?: string | null): ParameterRow[] {
  return definitions.map((def) => ({
    def,
    name: def.name,
    value: "",
    unit: def.unit,
    referenceRange: resolveReference(def, gender).referenceRange,
    flag: "normal",
    section: def.section,
  }));
}

export const blankRow = (): ParameterRow => ({ name: "", value: "", unit: "", referenceRange: "", flag: "normal" });

// What gets saved: rows with a result, without the editor-only fields.
export function toResultParameters(rows: ParameterRow[]): ResultParameter[] {
  return rows
    .filter((row) => row.name.trim() && row.value.trim())
    .map(({ name, value, unit, referenceRange, flag, section }) => ({
      name: name.trim(),
      value: value.trim(),
      unit,
      referenceRange,
      flag,
      ...(section ? { section } : {}),
    }));
}

export function ExamParametersEditor({
  rows,
  onChange,
  gender,
}: {
  rows: ParameterRow[];
  onChange: (rows: ParameterRow[]) => void;
  gender?: string | null;
}) {
  const t = useTranslations("examResults");

  const update = (index: number, patch: Partial<ParameterRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const setValue = (index: number, value: string) => {
    const row = rows[index];
    const suggested = row.def && !row.flagTouched ? deriveFlag(row.def, value, gender) : null;
    update(index, { value, ...(suggested ? { flag: suggested } : {}) });
  };

  // Fills every empty row with its normal answer: the first normal option, or the reference
  // text itself for descriptive rows (imaging findings). Numeric rows are left to measure.
  const fillNormal = () =>
    onChange(
      rows.map((row) => {
        if (row.value.trim() || !row.def) return row;
        const def = row.def;
        if (def.options?.length) {
          const normal = def.normalOptions?.[0];
          return normal ? { ...row, value: normal, flag: "normal" } : row;
        }
        const ref = resolveReference(def, gender);
        const isNumeric = ref.low !== undefined || ref.high !== undefined;
        if (isNumeric || !def.referenceRange || def.referenceRange === "—") return row;
        return { ...row, value: def.referenceRange, flag: "normal" };
      })
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">{t("auto_flag_hint")}</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-green-700" onClick={fillNormal}>
          <CheckCheck className="h-3.5 w-3.5 mr-1" /> {t("fill_normal")}
        </Button>
      </div>

      <div className="hidden md:grid grid-cols-[1.4fr_1fr_0.5fr_1.1fr_0.8fr_20px] gap-2 px-1 text-[10px] font-bold uppercase text-slate-400">
        <span>{t("parameter")}</span>
        <span>{t("result")}</span>
        <span>{t("unit")}</span>
        <span>{t("reference")}</span>
        <span>{t("flag")}</span>
        <span />
      </div>

      {rows.map((row, index) => {
        const showSection = row.section && row.section !== rows[index - 1]?.section;
        const fromCatalog = Boolean(row.def);
        return (
          <div key={index}>
            {showSection && (
              <div className="mt-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-700">{row.section}</div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_0.5fr_1.1fr_0.8fr_20px] gap-2 items-center rounded-md md:rounded-none border md:border-0 border-slate-200 p-2 md:p-0">
              {fromCatalog ? (
                <span className="col-span-2 md:col-span-1 text-xs font-medium text-slate-800">{row.name}</span>
              ) : (
                <Input
                  value={row.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  placeholder={t("parameter")}
                  className="col-span-2 md:col-span-1 h-8 text-xs"
                />
              )}

              {row.def?.options?.length ? (
                <select
                  value={row.value}
                  onChange={(e) => setValue(index, e.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                >
                  <option value="">—</option>
                  {row.def.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <Input
                  value={row.value}
                  onChange={(e) => setValue(index, e.target.value)}
                  placeholder={t("result")}
                  className="h-8 text-xs font-mono"
                />
              )}

              {fromCatalog ? (
                <span className="text-xs text-slate-500">{row.unit}</span>
              ) : (
                <Input value={row.unit} onChange={(e) => update(index, { unit: e.target.value })} placeholder={t("unit")} className="h-8 text-xs" />
              )}

              {fromCatalog ? (
                <span className="col-span-2 md:col-span-1 text-[11px] text-slate-500 leading-tight">{row.referenceRange}</span>
              ) : (
                <Input
                  value={row.referenceRange}
                  onChange={(e) => update(index, { referenceRange: e.target.value })}
                  placeholder={t("reference")}
                  className="col-span-2 md:col-span-1 h-8 text-xs"
                />
              )}

              <select
                value={row.flag}
                onChange={(e) => update(index, { flag: e.target.value as ResultFlag, flagTouched: true })}
                className={cn(
                  "h-8 rounded-md border px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400",
                  row.flag === "critical" ? "border-red-300 text-red-700 bg-red-50" :
                  row.flag === "normal" ? "border-slate-200 bg-white" : "border-orange-200 text-orange-700 bg-orange-50"
                )}
              >
                {FLAGS.map((flag) => (
                  <option key={flag} value={flag}>{t(`flags.${flag}`)}</option>
                ))}
              </select>

              {fromCatalog ? (
                <span />
              ) : (
                <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="text-slate-400 hover:text-red-600" title={t("remove")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      <Button type="button" variant="ghost" size="sm" className="text-xs text-blue-600" onClick={() => onChange([...rows, blankRow()])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> {t("add_parameter")}
      </Button>
    </div>
  );
}

// Read-only table used on the exam detail sheets and the consultation screen.
export function ExamParametersTable({ parameters }: { parameters: ResultParameter[] }) {
  const t = useTranslations("examResults");

  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50/50 text-[10px] text-slate-500">
        <tr>
          <th className="px-3 py-2 font-semibold">{t("parameter")}</th>
          <th className="px-3 py-2 font-semibold">{t("result")}</th>
          <th className="px-3 py-2 font-semibold">{t("unit")}</th>
          <th className="px-3 py-2 font-semibold">{t("reference")}</th>
          <th className="px-3 py-2 font-semibold">{t("flag")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {parameters.map((p, i) => {
          const showSection = p.section && p.section !== parameters[i - 1]?.section;
          return [
            showSection ? (
              <tr key={`section-${i}`} className="bg-slate-50">
                <td colSpan={5} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-700">{p.section}</td>
              </tr>
            ) : null,
            <tr key={i}>
              <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
              <td className={cn("px-3 py-2 font-bold", p.flag === "critical" ? "text-red-600" : p.flag === "normal" ? "text-slate-700" : "text-orange-600")}>{p.value}</td>
              <td className="px-3 py-2 text-slate-500">{p.unit}</td>
              <td className="px-3 py-2 text-slate-500">{p.referenceRange}</td>
              <td className="px-3 py-2">
                <span className={cn(
                  "px-1.5 py-0.5 rounded font-bold uppercase text-[9px] tracking-wider",
                  p.flag === "critical" ? "bg-red-100 text-red-700" :
                  p.flag === "normal" ? "bg-slate-100 text-slate-600" : "bg-orange-100 text-orange-700"
                )}>
                  {t(`flags.${p.flag}`)}
                </span>
              </td>
            </tr>,
          ];
        })}
      </tbody>
    </table>
  );
}
