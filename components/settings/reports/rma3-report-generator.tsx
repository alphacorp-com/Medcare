"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText } from "lucide-react";

function previousMonthPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const prev = new Date(Date.UTC(year, month - 1, 1));
  return `${prev.getUTCFullYear()}${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonthPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toInputValue(period: string): string {
  return `${period.slice(0, 4)}-${period.slice(4, 6)}`;
}

function toPeriod(inputValue: string): string {
  return inputValue.replace("-", "");
}

export function Rma3ReportGenerator() {
  const t = useTranslations("settings.reports");
  const [period, setPeriod] = useState(() => previousMonthPeriod());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxInputValue = toInputValue(currentMonthPeriod());

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/settings/reports/rma3?period=${period}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? t("generate_error"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `RMA3_${period}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError(t("generate_error"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <FileText className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t("title")}</h2>
            <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
          </div>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label htmlFor="rma3-period" className="text-xs font-medium text-slate-700">
              {t("period_label")}
            </label>
            <input
              id="rma3-period"
              type="month"
              value={toInputValue(period)}
              max={maxInputValue}
              onChange={(e) => setPeriod(toPeriod(e.target.value))}
              className="h-9 rounded border border-slate-300 px-3 text-sm"
            />
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating} className="h-9 text-xs">
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : (
              <Download className="h-3 w-3 mr-2" />
            )}
            {isGenerating ? t("generating") : t("generate_button")}
          </Button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-2">
        <h3 className="text-sm font-bold text-slate-900">{t("coverage_title")}</h3>
        <p className="text-xs text-slate-600">{t("coverage_included")}</p>
        <p className="text-xs text-slate-500">{t("coverage_excluded")}</p>
      </div>
    </div>
  );
}
