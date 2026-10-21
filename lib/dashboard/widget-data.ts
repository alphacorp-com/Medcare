// Payload shapes returned by GET /api/v1/dashboard/widgets/[id] and rendered by the
// generic dashboard components. Kept free of server imports so client code can use it.

export type WidgetTone = "default" | "success" | "warning" | "critical";

export interface StatWidgetData {
  value: number;
  // When set, the tile renders "value/total" plus a percentage.
  total?: number;
  unit?: "minutes";
  tone: WidgetTone;
}

export interface AmountWidgetData {
  // One entry per currency — amounts in different currencies are never summed together.
  amounts: Array<{ currency: string; value: number }>;
  count: number;
  tone: WidgetTone;
}

export interface ListWidgetItem {
  id: string;
  title: string;
  subtitle?: string;
  // ISO timestamp, formatted client-side in the viewer's locale.
  timestamp?: string;
  amount?: { currency: string; value: number };
  // Translation key under dashboard.badges.
  badge?: { key: string; tone: WidgetTone };
  // Locale-less app path, pushed through the i18n router.
  href?: string;
}

export interface ListWidgetData {
  items: ListWidgetItem[];
  // Total matching rows; items is capped (LIST_LIMIT).
  total: number;
  // Locale-less app path of the module page holding the full list.
  viewAllHref?: string;
}

export type WidgetData = StatWidgetData | AmountWidgetData | ListWidgetData;

export const LIST_LIMIT = 8;
