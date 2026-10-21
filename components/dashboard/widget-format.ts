import { isToday } from "date-fns";
import type { WidgetTone } from "@/lib/dashboard/widget-data";

export const TONE_TEXT: Record<WidgetTone, string> = {
  default: "text-slate-600",
  success: "text-green-600",
  warning: "text-amber-600",
  critical: "text-red-600",
};

export const TONE_BADGE: Record<WidgetTone, string> = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  critical: "bg-red-50 text-red-700",
};

export function formatAmount(value: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    // Unknown ISO code stored on a record — show the raw code rather than failing the tile.
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} ${currency}`;
  }
}

// Time only for today's entries, short date otherwise.
export function formatTimestamp(iso: string, locale: string): string {
  const date = new Date(iso);
  return isToday(date)
    ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}
