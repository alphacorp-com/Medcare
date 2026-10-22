"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { schemeColumns, type IndicatorRow, type Rma3HivReport } from "@/lib/hiv/rma3-hiv";
import { indicatorsToCsv } from "@/lib/hiv/rma3-csv";
import { EpiMonthPicker, currentMonth } from "./epi-shared";

// The HIV / hepatitis RMA3 tables of a month with the full age × sex detail, to check the
// figures before copying them to the official form (the Word RMA3 prints them condensed).

const SECTIONS: { key: keyof Rma3HivReport; title: string }[] = [
  { key: "antenatalScreening", title: "II.1.1 - Syphilis et hépatite B en CPN" },
  { key: "pmtctAntenatal", title: "II.3.1 - PTME en CPN" },
  { key: "pmtctMaternity", title: "II.3.2 - PTME en salle d'accouchement" },
  { key: "pmtctReferrals", title: "II.3.3 - Références ASC / OBC" },
  { key: "pmtctViralLoad", title: "II.3.4 - Charge virale des femmes enceintes" },
  { key: "pmtctPostnatal", title: "II.3.5 - Suivi post-natal" },
  { key: "hivTesting", title: "IV.1.1 - Dépistage du VIH" },
  { key: "artFollowUp", title: "IV.1.2 - Suivi des PVVIH sous ARV" },
  { key: "hepatitisSti", title: "IV.1.3 - Hépatites virales et IST" },
];

function IndicatorTable({ rows }: { rows: readonly IndicatorRow[] }) {
  // A section may mix schemes (II.3.5: children, then women): one table per scheme.
  const groups = rows.reduce<IndicatorRow[][]>((acc, row) => {
    const last = acc[acc.length - 1];
    if (last && last[0].scheme === row.scheme) last.push(row);
    else acc.push([row]);
    return acc;
  }, []);
  return (
    <>
      {groups.map((group) => {
        const columns = schemeColumns(group[0].scheme);
        return (
          <div key={group[0].code} className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-2 py-1.5 min-w-64">Indicateur</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-2 py-1.5 text-right whitespace-nowrap">{c.label}</th>
                  ))}
                  <th className="px-2 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.map((row) => (
                  <tr key={row.code}>
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5">
                      <span className="font-mono text-[10px] text-slate-400">{row.code}</span> {row.label}
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 text-right font-mono text-slate-600">{row.cells[c.key] || ""}</td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

export function HivReportView() {
  const t = useTranslations("diseasePrograms.hiv");
  const [month, setMonth] = useState(currentMonth);
  const query = useQuery({ queryKey: ["hiv", "rma3", month], queryFn: () => apiFetch<{ data: Rma3HivReport }>(`/api/v1/hiv/rma3?month=${month}`) });
  const report = query.data?.data;

  const download = () => {
    if (!report) return;
    const csv = indicatorsToCsv(SECTIONS.map((s) => ({ title: s.title, rows: report[s.key] as IndicatorRow[] })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rma3-vih-hepatites-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <EpiMonthPicker month={month} onChange={setMonth} />
        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!report} onClick={download}>
          <Download className="mr-1 h-3.5 w-3.5" /> {t("report_csv")}
        </Button>
        <p className="text-[11px] text-slate-500 max-w-xl">{t("report_hint")}</p>
      </div>
      {query.isPending ? (
        <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
      ) : query.isError || !report ? (
        <p className="text-xs text-red-600">{t("load_error")}</p>
      ) : (
        SECTIONS.map((s) => (
          <section key={s.key} className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{s.title}</h3>
            <IndicatorTable rows={report[s.key] as IndicatorRow[]} />
          </section>
        ))
      )}
    </div>
  );
}
