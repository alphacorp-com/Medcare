"use client";

import { useTranslations } from "next-intl";

export function PatientQueue() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');

  return (
    <div className="flex flex-col bg-white rounded border border-slate-200 shadow-sm h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-800">
          {t('queue_title')} 
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-normal italic">
            {t('updated')} 1m ago
          </span>
        </h2>
        <div className="flex gap-2">
          <button className="p-1.5 hover:bg-slate-100 rounded border border-slate-200 text-xs">{tc('search')}</button>
          <button className="p-1.5 bg-blue-600 text-white rounded text-xs px-3">+ {tc('patients')}</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
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
            <tr className="hover:bg-blue-50/50">
              <td className="px-4 py-3 font-mono">#8821</td>
              <td className="px-4 py-3 font-medium">Marcus Valerius</td>
              <td className="px-4 py-3">Dr. S. Chen</td>
              <td className="px-4 py-3">08:45</td>
              <td className="px-4 py-3">12m</td>
              <td className="px-4 py-3 text-slate-600">{tc('active')}</td>
            </tr>
            <tr className="hover:bg-blue-50/50">
              <td className="px-4 py-3 font-mono">#8822</td>
              <td className="px-4 py-3 font-medium">Isabella Santiago</td>
              <td className="px-4 py-3">Dr. K. Patel</td>
              <td className="px-4 py-3">09:12</td>
              <td className="px-4 py-3">8m</td>
              <td className="px-4 py-3 text-slate-600">{tc('active')}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
        <span>{t('view_all')}</span>
        <div className="flex gap-4">
          <a href="#" className="text-blue-600 font-semibold cursor-pointer">{t('view_all')}</a>
          <a href="#" className="text-blue-600 font-semibold cursor-pointer">{tc('print')}</a>
        </div>
      </div>
    </div>
  );
}
