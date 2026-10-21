"use client";

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Read-only display of recorded ICD-10 diagnoses (stay page, patient record), grouped by
// the moment they were coded: consultation, discharge, cause of death.

export interface RecordedDiagnosis {
  id: string;
  icd10Code: string;
  label: string;
  kind: "principal" | "secondary";
  context: "consultation" | "discharge" | "death";
  isNewCase: boolean;
  recordedAt: string;
}

const CONTEXT_ORDER: RecordedDiagnosis["context"][] = ["consultation", "discharge", "death"];

export function DiagnosisList({ diagnoses, showDate = false }: { diagnoses: RecordedDiagnosis[]; showDate?: boolean }) {
  const t = useTranslations("diagnoses");
  const format = useFormatter();

  if (diagnoses.length === 0) return <p className="text-xs text-slate-400">{t("none_recorded")}</p>;

  return (
    <div className="space-y-3">
      {CONTEXT_ORDER.map((context) => {
        const items = diagnoses.filter((d) => d.context === context);
        if (items.length === 0) return null;
        // Principal first, then secondary, each in recording order.
        const sorted = [...items].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "principal" ? -1 : 1));
        return (
          <div key={context} className="space-y-1.5">
            <p className={cn("text-[10px] font-bold uppercase tracking-widest", context === "death" ? "text-red-700" : "text-slate-500")}>
              {t(`context_${context}`)}
            </p>
            <ul className="space-y-1">
              {sorted.map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-xs">
                  <span className="w-12 shrink-0 font-mono font-semibold text-blue-700">{d.icd10Code}</span>
                  <span className="min-w-0 flex-1 text-slate-800">
                    {d.label}
                    {showDate && (
                      <span className="ml-1 text-[11px] text-slate-400">· {format.dateTime(new Date(d.recordedAt), { dateStyle: "short" })}</span>
                    )}
                  </span>
                  {context !== "death" && (
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        d.kind === "principal" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {t(`kind_${d.kind}`)}
                    </span>
                  )}
                  {d.isNewCase && context === "consultation" && (
                    <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{t("new_case")}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
