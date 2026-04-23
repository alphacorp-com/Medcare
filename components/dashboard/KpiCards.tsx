"use client";

import { useTranslations } from "next-intl";

export function KpiCards() {
  const t = useTranslations('dashboard');

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('active_consultations')}</div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-slate-900">42</span>
          <span className="text-xs text-green-600 font-medium mb-1">+12% vs yesterday</span>
        </div>
      </div>
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('er_wait_time')}</div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-slate-900">14<span className="text-sm text-slate-400">m</span></span>
          <span className="text-xs text-red-600 font-medium mb-1">{t('increasing')}</span>
        </div>
      </div>
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('lab_processing')}</div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-slate-900">186</span>
          <span className="text-xs text-blue-600 font-medium mb-1">8 urgent pending</span>
        </div>
      </div>
      <div className="flex-1 bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">{t('system_monitor')}</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span>{t('api_gateway')}</span>
            <span className="text-green-600">{t('stable')}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>{t('db_clusters')}</span>
            <span className="text-green-600">99.9%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>{t('storage')}</span>
            <span className="text-yellow-600">{t('peak_load')}</span>
          </div>
        </div>
        <div className="mt-auto">
          <button className="w-full py-2 bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded uppercase tracking-wide">{t('view_logs')}</button>
        </div>
      </div>
    </div>
  );
}
