"use client";

import { useTranslations } from "next-intl";

export function StockAlerts() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');

  return (
    <div className="bg-slate-900 text-white rounded border border-slate-700 shadow-lg p-4">
      <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">{t('stock_alerts')}</div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="text-[11px]">
            <div className="font-medium">IV Fluids 0.9%</div>
            <div className="text-slate-500 text-[10px]">{t('low')}</div>
          </div>
          <div className="text-red-400 text-xs font-bold">12 {t('units')}</div>
        </div>
        <button className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-widest transition-colors cursor-pointer border-none outline-none">
          {tc('save')}
        </button>
      </div>
    </div>
  );
}
