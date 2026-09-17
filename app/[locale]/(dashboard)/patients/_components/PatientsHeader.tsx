"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Filter, UserPlus, Download } from "lucide-react";

interface PatientsHeaderProps {
  onExport: () => void;
  onFilterToggle: () => void;
  onNewPatient: () => void;
}

export function PatientsHeader({ onExport, onFilterToggle, onNewPatient }: PatientsHeaderProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
      <div className="mb-3">
        <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-xs text-slate-500">{t('description')}</p>
      </div>

      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 sm:flex sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full justify-center rounded-xl border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
          onClick={onExport}
        >
          <Download className="mr-2 h-3.5 w-3.5" />
          {tc('export')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full justify-center rounded-xl border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
          onClick={onFilterToggle}
        >
          <Filter className="mr-2 h-3.5 w-3.5" />
          {t('advanced_filters')}
        </Button>

        <Button
          size="sm"
          className="h-10 w-full justify-center rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
          onClick={onNewPatient}
        >
          <UserPlus className="mr-2 h-3.5 w-3.5" />
          {t('new_patient')}
        </Button>
      </div>
    </div>
  );
}
