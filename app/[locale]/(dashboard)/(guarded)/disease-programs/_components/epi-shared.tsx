"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

// Small pieces shared by the EPI tabs (sessions, cold chain, AEFI).

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export const epiSelectClass =
  "flex h-8 rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400";

export function EpiMonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const t = useTranslations("diseasePrograms.epi");
  return (
    <label className="space-y-1">
      <span className="block text-[10px] font-bold uppercase text-slate-500">{t("month")}</span>
      <Input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-8 w-40 text-xs" />
    </label>
  );
}

const KNOWN_CODES = new Set([
  "invalid_date",
  "future_date",
  "invalid_strategy",
  "invalid_site",
  "invalid_status",
  "invalid_notes",
  "session_has_doses",
  "invalid_seriousness",
  "invalid_outcome",
  "invalid_description",
  "invalid_immunization",
  "onset_before_dose",
  "invalid_code",
  "duplicate_code",
  "invalid_label",
  "invalid_type",
  "invalid_range",
  "invalid_temperature",
  "invalid_equipment",
  "invalid_location",
]);

// ApiError messages carry the route's error code: translate the known ones.
export function useEpiApiError() {
  const t = useTranslations("diseasePrograms.epi.errors");
  const tc = useTranslations("common");
  return (error: unknown): string => {
    const code = error instanceof Error ? error.message : "";
    return KNOWN_CODES.has(code) ? t(code) : tc("unknown_error");
  };
}
