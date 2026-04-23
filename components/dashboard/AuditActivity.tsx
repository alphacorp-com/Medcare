"use client";

import { useTranslations } from "next-intl";

export function AuditActivity() {
  const t = useTranslations('dashboard');

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">{t('audit_activity')}</h2>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div className="border-l-2 border-blue-500 pl-3 relative">
          <div className="text-[11px] font-bold">Patient Access</div>
          <div className="text-[10px] text-slate-500">Record: #772</div>
          <div className="text-[9px] text-slate-400 mt-1">2 mins ago</div>
        </div>
      </div>
    </div>
  );
}
