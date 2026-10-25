"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import { usePdfBranding } from "@/components/templates/usePdfBranding";
import type { StockReportPdfData } from "@/components/templates/StockReportTemplate";
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
  const [printOpen, setPrintOpen] = useState(false);
  const { facility: pdfFacility, settings: pdfSettings } = usePdfBranding();

  const categoryLabel =
    category === "all" ? t("report_all_categories") : category === "none" ? t("rma3_category_none") : t(`rma3_category_${category}`);
  const pdfData: StockReportPdfData = {
    period: month.split("-").reverse().join("/"),
    category: categoryLabel,
    rows: rows.map((r) => ({
      name: r.name,
      unit: r.unit,
      opening: r.opening,
      received: r.received,
      consumed: r.consumed,
      losses: r.losses.expired + r.losses.damaged + r.losses.lost,
      adjusted: r.adjusted,
      closing: r.closing,
      cmm: r.cmm,
      stockoutDays: r.stockoutDays,
      vaccine: r.vaccine,
    })),
    labels: {
      title: t("report_pdf_title"),
      articles: t("report_pdf_articles"),
      in_stockout: t("report_pdf_in_stockout"),
      article: t("report_article"),
      opening: t("report_opening"),
      received: t("report_received"),
      consumed: t("report_consumed"),
      losses: t("report_losses"),
      adjusted: t("report_adjusted"),
      closing: t("report_closing"),
      cmm: t("report_cmm"),
      stockout_days: t("report_stockout_days"),
      doses_given: t("report_doses_given"),
      doses_wasted: t("report_doses_wasted"),
      wastage: t("report_wastage"),
      empty: t("report_empty"),
    },
  };

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
        <p className="text-[11px] text-slate-500 max-w-xl flex-1">{t("report_hint")}</p>
        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!query.isSuccess} onClick={() => setPrintOpen(true)}>
          <Printer className="mr-2 h-3.5 w-3.5" /> {t("report_print")}
        </Button>
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

      <PDFPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        templateId="stock_reports"
        data={pdfData}
        facility={pdfFacility}
        settings={pdfSettings}
        fileName={`rapport-stock-${period}`}
      />
    </div>
  );
}
