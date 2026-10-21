"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { printRegion } from "@/lib/print-region";
import { TriageBadge, type TriageAcuity } from "@/components/shared/triage-badge";

interface QueueItem {
  id: string;
  ipp: string;
  name: string;
  provider: string;
  timeIn: string;
  waiting: number;
  status: string;
  type: string;
  triageAcuity: TriageAcuity | null;
}

export function PatientQueue() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const tp = useTranslations('patients');
  const locale = useLocale();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  // Shared cached query: refreshed every 30_000 ms, paused while the tab is hidden.
  const query = useQuery({
    queryKey: ["dashboard", "queue"],
    queryFn: () => apiFetch<{ data: QueueItem[] }>("/api/v1/dashboard/queue"),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
  const queue = query.data?.data ?? [];
  const loading = query.isPending;
  const error = query.isError && !query.data;

  const formatWaitingTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div ref={cardRef} className="flex flex-col bg-white rounded border border-slate-200 shadow-sm h-full overflow-hidden">
      <div className="p-3 lg:p-4 border-b border-slate-200 flex justify-between items-center gap-3">
        <h2 className="text-sm font-bold text-slate-800">
          {t('queue_title')}
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-normal italic">
            {t('updated')} {new Date().toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </h2>
        <div className="flex gap-2 print-hide">
          {/* Opens the patients page with its "new patient" form already open (?new=1). */}
          <button
            type="button"
            onClick={() => router.push('/patients?new=1')}
            className="p-1.5 bg-blue-600 text-white rounded text-xs px-3 hover:bg-blue-700"
          >
            + {tp('new_patient')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse text-slate-500 text-sm">{t('loading_queue')}</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 text-sm">{t('failed_load_queue')}</div>
          </div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-slate-500 text-sm">{t('no_active_patients')}</div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 bg-white">
                <th className="px-4 py-2">{tc('ipp')}</th>
                <th className="px-4 py-2">{tc('name')}</th>
                <th className="px-4 py-2">{t('provider')}</th>
                <th className="px-4 py-2">{t('time_in')}</th>
                <th className="px-4 py-2">{t('waiting')}</th>
                <th className="px-4 py-2">{tc('status')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => router.push(`/stays/${item.id}`)}>
                  <td className="px-4 py-3 font-mono">#{item.ipp}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{item.provider}</td>
                  <td className="px-4 py-3">{item.timeIn}</td>
                  <td className={`px-4 py-3 ${item.waiting > 60 ? 'text-red-600 font-medium' : ''}`}>
                    {formatWaitingTime(item.waiting)}
                  </td>
                  <td className="px-4 py-3">
                    {item.type === "emergency" && item.triageAcuity ? (
                      <TriageBadge acuity={item.triageAcuity} />
                    ) : (
                      <span className="text-slate-600">{tc('active')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
        <span>{t('showing')} {queue.length} {tc('patients')}</span>
        <div className="flex gap-4 print-hide">
          <button
            type="button"
            onClick={() => router.push('/stays')}
            className="text-blue-600 font-semibold hover:underline"
          >
            {t('view_all')}
          </button>
          <button
            type="button"
            onClick={() => printRegion(cardRef.current)}
            disabled={loading || queue.length === 0}
            className="text-blue-600 font-semibold hover:underline disabled:text-slate-400 disabled:no-underline"
          >
            {tc('print')}
          </button>
        </div>
      </div>
    </div>
  );
}
