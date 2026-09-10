"use client";

import { useTranslations } from "next-intl";

export function DashboardFooter() {
  const t = useTranslations('dashboard');

  return (
    <footer className="h-6 bg-slate-800 text-slate-400 text-[10px] flex items-center justify-between px-4 shrink-0 rounded mt-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          <span>{t('cloud_status')}: {t('optimal')}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 uppercase font-bold">
        <span>v2.1.0</span>
      </div>
    </footer>
  );
}
