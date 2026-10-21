"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { RMA3_STOCK_CATEGORIES, type Rma3StockCategory } from "@/lib/stock/input";
import type { StockReportItemRow } from "@/lib/stock/report-data";
import { cn } from "@/lib/utils";

// Monthly stock report (GET /api/v1/pharmacy/stock-report): one row per article, all depots.

const previousMonth = () => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
};

export function StockReportTab() {
  const t = useTranslations("stock");
  const [month, setMonth] = useState(previousMonth); // YYYY-MM
  const [category, setCategory] = useState<Rma3StockCategory | "all" | "none">("all");
  const period = month.replace("-", "");

  const query = useQuery({
    queryKey: ["pharmacy", "stock-report", period],
    queryFn: () => apiFetch<{ data: { rows: StockReportItemRow[] } }>(`/api/v1/pharmacy/stock-report?period=${period}`),
    enabled: /^\d{6}$/.test(period),
  });
  const rows = (query.data?.data.rows ?? []).filter((r) =>
    category === "all" ? true : category === "none" ? r.rma3Category === null : r.rma3Category === category
  );
  const hasVaccines = rows.some((r) => r.vaccine);

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-3">
        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase text-slate-500">{t("report_month")}</span>
          <Input type="month" value={month} max={new Date().toISOString().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} className="h-8 w-40 text-xs" />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase text-slate-500">{t("rma3_category")}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="flex h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
          >
            <option value="all">{t("report_all_categories")}</option>
            {RMA3_STOCK_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`rma3_category_${c}`)}</option>
            ))}
            <option value="none">{t("rma3_category_none")}</option>
          </select>
        </label>
        <p className="text-[11px] text-slate-500 max-w-xl">{t("report_hint")}</p>
      </div>

      <div className="flex-1 overflow-auto rounded border border-slate-200 bg-white">
        {query.isPending ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : query.isError ? (
          <p className="p-4 text-xs text-red-600">{t("load_error")}</p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("report_article")}</th>
                <th className="px-3 py-2 text-right">{t("report_opening")}</th>
                <th className="px-3 py-2 text-right">{t("report_received")}</th>
                <th className="px-3 py-2 text-right">{t("report_consumed")}</th>
                <th className="px-3 py-2 text-right">{t("report_losses")}</th>
                <th className="px-3 py-2 text-right">{t("report_adjusted")}</th>
                <th className="px-3 py-2 text-right">{t("report_closing")}</th>
                <th className="px-3 py-2 text-right">{t("report_cmm")}</th>
                <th className="px-3 py-2 text-right">{t("report_stockout_days")}</th>
                {hasVaccines && (
                  <>
                    <th className="px-3 py-2 text-right">{t("report_doses_given")}</th>
                    <th className="px-3 py-2 text-right">{t("report_doses_wasted")}</th>
                    <th className="px-3 py-2 text-right">{t("report_wastage")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr><td colSpan={12} className="py-8 text-center text-slate-500">{t("report_empty")}</td></tr>
              )}
              {rows.map((r) => {
                const losses = r.losses.expired + r.losses.damaged + r.losses.lost;
                return (
                  <tr key={r.itemId} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-800">{r.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {r.unit ?? ""}{r.rma3Category ? ` · ${t(`rma3_category_${r.rma3Category}`)}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.opening}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{r.received || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.consumed || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700" title={t("report_losses_detail", r.losses)}>{losses || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.adjusted ? (r.adjusted > 0 ? `+${r.adjusted}` : r.adjusted) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{r.closing}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.cmm}</td>
                    <td className={cn("px-3 py-2 text-right font-mono", r.stockoutDays > 0 && "font-semibold text-red-700")}>{r.stockoutDays}</td>
                    {hasVaccines && (
                      <>
                        <td className="px-3 py-2 text-right font-mono">{r.vaccine ? r.vaccine.dosesAdministered : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.vaccine ? r.vaccine.dosesWasted : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.vaccine?.wastageRate != null ? `${r.vaccine.wastageRate} %` : "—"}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
