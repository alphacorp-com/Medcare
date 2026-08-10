"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface KpiData {
  activeConsultations: number;
  consultationChange: number;
  avgWaitTime: number;
  pendingLabs: number;
  bedOccupancy: {
    total: number;
    occupied: number;
    available: number;
    maintenance: number;
    reserved: number;
  };
  systemStatus: {
    apiGateway: string;
    dbClusters: number;
    storage: string;
  };
}

export function KpiCards() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const res = await fetch('/api/v1/dashboard/kpis');
        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || t('failed_fetch_kpis'));
        }

        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('unknown_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 h-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded border border-slate-200 shadow-sm animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-slate-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-4 h-full">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
          <div className="text-xs text-red-600">{t('failed_load_dashboard')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('active_consultations')}</div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-slate-900">{data.activeConsultations}</span>
          <span className={`text-xs font-medium mb-1 ${data.consultationChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.consultationChange >= 0 ? '+' : ''}{data.consultationChange}% {t('vs_yesterday')}
          </span>
        </div>
      </div>

      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('er_wait_time')}</div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-slate-900">{data.avgWaitTime}<span className="text-sm text-slate-400">{t('minutes_short')}</span></span>
          <span className={`text-xs font-medium mb-1 ${data.avgWaitTime > 15 ? 'text-red-600' : 'text-green-600'}`}>
            {data.avgWaitTime > 15 ? t('increasing') : t('normal')}
          </span>
        </div>
      </div>

      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('lab_processing')}</div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-slate-900">{data.pendingLabs}</span>
          <span className="text-xs text-blue-600 font-medium mb-1">
            {data.pendingLabs > 10 ? `${Math.floor(data.pendingLabs / 10) * 10}+` : data.pendingLabs} {t('pending')}
          </span>
        </div>
      </div>

      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('bed_occupancy')}</div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-slate-900">
            {data.bedOccupancy.occupied}<span className="text-sm text-slate-400">/{data.bedOccupancy.total}</span>
          </span>
          <span className={`text-xs font-medium mb-1 ${data.bedOccupancy.total > 0 && data.bedOccupancy.occupied / data.bedOccupancy.total > 0.9 ? 'text-red-600' : 'text-blue-600'}`}>
            {data.bedOccupancy.total > 0 ? Math.round((data.bedOccupancy.occupied / data.bedOccupancy.total) * 100) : 0}% {t('occupied')}
          </span>
        </div>
      </div>

      <div className="flex-1 bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">{t('system_monitor')}</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span>{t('api_gateway')}</span>
            <span className={`font-medium ${data.systemStatus.apiGateway === 'stable' ? 'text-green-600' : 'text-red-600'}`}>
              {t(data.systemStatus.apiGateway)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>{t('db_clusters')}</span>
            <span className={`font-medium ${data.systemStatus.dbClusters >= 99.9 ? 'text-green-600' : 'text-yellow-600'}`}>
              {data.systemStatus.dbClusters}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>{t('storage')}</span>
            <span className={`font-medium ${data.systemStatus.storage === 'normal' ? 'text-green-600' : 'text-yellow-600'}`}>
              {t(data.systemStatus.storage)}
            </span>
          </div>
        </div>
        <div className="mt-auto">
          <button className="w-full py-2 bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded uppercase tracking-wide">
            {t('view_logs')}
          </button>
        </div>
      </div>
    </div>
  );
}
