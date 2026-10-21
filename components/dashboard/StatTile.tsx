"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AmountWidgetData, StatWidgetData } from "@/lib/dashboard/widget-data";
import { useWidgetData } from "@/components/dashboard/useWidgetData";
import { TONE_TEXT, formatAmount } from "@/components/dashboard/widget-format";

interface TileProps {
  widgetId: string;
  refreshMs: number;
  // Ids of the widgets fetched together with this one (see widgetRefreshBatches).
  batchIds: string[];
}

function TileFrame({ widgetId, children }: { widgetId: string; children: React.ReactNode }) {
  const t = useTranslations("dashboard");
  return (
    <div className="bg-white p-3 lg:p-4 rounded border border-slate-200 shadow-sm min-w-0">
      <div className="text-[10px] lg:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 truncate">
        {t(`widgets.${widgetId}`)}
      </div>
      {children}
    </div>
  );
}

function TilePlaceholder({ failed }: { failed: boolean }) {
  const t = useTranslations("dashboard");
  return failed ? (
    <div className="text-xs text-red-600">{t("widget_load_failed")}</div>
  ) : (
    <div className="h-7 bg-slate-200 rounded w-1/2 animate-pulse" />
  );
}

export function StatTile({ widgetId, refreshMs, batchIds }: TileProps) {
  const t = useTranslations("dashboard");
  const state = useWidgetData<StatWidgetData>(widgetId, refreshMs, batchIds);

  return (
    <TileFrame widgetId={widgetId}>
      {state.status !== "ready" ? (
        <TilePlaceholder failed={state.status === "error"} />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-x-2">
          <span className="text-2xl lg:text-3xl font-bold text-slate-900">
            {state.data.value}
            {state.data.unit === "minutes" && <span className="text-sm text-slate-400">{t("minutes_short")}</span>}
            {state.data.total !== undefined && <span className="text-sm text-slate-400">/{state.data.total}</span>}
          </span>
          {state.data.total !== undefined && (
            <span className={`text-xs font-medium mb-1 ${TONE_TEXT[state.data.tone]}`}>
              {state.data.total > 0 ? Math.round((state.data.value / state.data.total) * 100) : 0}%
            </span>
          )}
        </div>
      )}
    </TileFrame>
  );
}

export function AmountTile({ widgetId, refreshMs, batchIds }: TileProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const state = useWidgetData<AmountWidgetData>(widgetId, refreshMs, batchIds);

  return (
    <TileFrame widgetId={widgetId}>
      {state.status !== "ready" ? (
        <TilePlaceholder failed={state.status === "error"} />
      ) : (
        <div className="flex flex-col gap-0.5">
          {state.data.amounts.length === 0 ? (
            <span className="text-2xl lg:text-3xl font-bold text-slate-900">0</span>
          ) : (
            state.data.amounts.map((amount) => (
              <span key={amount.currency} className="text-xl lg:text-2xl font-bold text-slate-900 truncate">
                {formatAmount(amount.value, amount.currency, locale)}
              </span>
            ))
          )}
          <span className={`text-xs font-medium ${TONE_TEXT[state.data.tone]}`}>
            {t(`widget_counts.${widgetId}`, { count: state.data.count })}
          </span>
        </div>
      )}
    </TileFrame>
  );
}
