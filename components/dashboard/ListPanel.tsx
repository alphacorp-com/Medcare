"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { ListWidgetData } from "@/lib/dashboard/widget-data";
import { useWidgetData } from "@/components/dashboard/useWidgetData";
import { TONE_BADGE, formatAmount, formatTimestamp } from "@/components/dashboard/widget-format";

interface ListPanelProps {
  widgetId: string;
  refreshMs: number;
  // Ids of the widgets fetched together with this one (see widgetRefreshBatches).
  batchIds: string[];
}

export function ListPanel({ widgetId, refreshMs, batchIds }: ListPanelProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const router = useRouter();
  const state = useWidgetData<ListWidgetData>(widgetId, refreshMs, batchIds);
  const viewAllHref = state.status === "ready" ? state.data.viewAllHref : undefined;

  return (
    <div className="flex flex-col bg-white rounded border border-slate-200 shadow-sm h-full overflow-hidden">
      <div className="p-3 lg:p-4 border-b border-slate-200 flex justify-between items-center gap-3 shrink-0">
        <h2 className="text-sm font-bold text-slate-800 truncate">{t(`widgets.${widgetId}`)}</h2>
        {state.status === "ready" && (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full font-semibold shrink-0">
            {state.data.total}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {state.status === "loading" ? (
          <div className="p-6 text-center text-sm text-slate-500 animate-pulse">{t("widget_loading")}</div>
        ) : state.status === "error" ? (
          <div className="p-6 text-center text-sm text-red-600">{t("widget_load_failed")}</div>
        ) : state.data.items.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">{t("widget_empty")}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.data.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!item.href}
                  onClick={() => item.href && router.push(item.href)}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50/50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">{item.title}</div>
                    {item.subtitle && <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {item.amount ? (
                      <span className="text-xs font-semibold text-slate-900">
                        {formatAmount(item.amount.value, item.amount.currency, locale)}
                      </span>
                    ) : (
                      item.timestamp && (
                        <span className="text-[11px] text-slate-500">{formatTimestamp(item.timestamp, locale)}</span>
                      )
                    )}
                    {item.badge && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TONE_BADGE[item.badge.tone]}`}>
                        {t(`badges.${item.badge.key}`)}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {state.status === "ready" && viewAllHref && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <span>{t("widget_showing", { shown: state.data.items.length, total: state.data.total })}</span>
          <button
            type="button"
            onClick={() => router.push(viewAllHref)}
            className="text-blue-600 font-semibold hover:underline"
          >
            {t("widget_view_all")}
          </button>
        </div>
      )}
    </div>
  );
}
