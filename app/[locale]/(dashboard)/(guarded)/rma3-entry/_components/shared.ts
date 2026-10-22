"use client";

import { useTranslations } from "next-intl";

// Error codes of the /api/v1/rma3-entry routes (lib/rma3-manual): translated when known.
const KNOWN_CODES = new Set([
  "invalid_period",
  "future_period",
  "invalid_body",
  "unknown_indicator",
  "unknown_breakdown",
  "duplicate_cell",
  "invalid_value",
  "invalid_reason",
  "period_validated",
  "period_not_validated",
  "period_not_found",
  "invalid_region",
  "invalid_department",
  "invalid_arrondissement",
  "invalid_district",
  "invalid_healthArea",
  "invalid_dataManagerName",
  "invalid_facilityManagerName",
  "invalid_dataManagerPhone",
  "invalid_villagesServed",
  "invalid_villagesOutreach",
  "invalid_ownership",
]);

export function useRma3ApiError() {
  const t = useTranslations("rma3Entry.errors");
  const tc = useTranslations("common");
  return (error: unknown): string => {
    const code = error instanceof Error ? error.message : "";
    return KNOWN_CODES.has(code) ? t(code) : tc("unknown_error");
  };
}

// The RMA3 is reported for the month that just ended: it is the default.
export function previousMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

export const selectClass =
  "flex h-8 rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-500";
