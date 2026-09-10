"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
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
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await fetch('/api/v1/dashboard/queue');
        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || t('failed_fetch_queue'));
        }

        setQueue(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : tc('unknown_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();

    // Refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatWaitingTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="flex flex-col bg-white rounded border border-slate-200 shadow-sm h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-800">
          {t('queue_title')}
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-normal italic">
            {t('updated')} {new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
        </h2>
        <div className="flex gap-2">
          {/* <button className="p-1.5 hover:bg-slate-100 rounded border border-slate-200 text-xs">
            {tc('search')}
          </button> */}
          <button
            onClick={() => router.push('/patients')}
            className="p-1.5 bg-blue-600 text-white rounded text-xs px-3 hover:bg-blue-700"
          >
            + {tc('patients')}
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
        <div className="flex gap-4">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); router.push('/stays'); }}
            className="text-blue-600 font-semibold cursor-pointer hover:underline"
          >
            {t('view_all')}
          </a>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.print(); }}
            className="text-blue-600 font-semibold cursor-pointer hover:underline"
          >
            {tc('print')}
          </a>
        </div>
      </div>
    </div>
  );
}
