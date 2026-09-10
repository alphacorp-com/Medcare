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
    <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-slate-800">{t('title')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onExport}>
          <Download className="h-3.5 w-3.5 mr-2" /> {tc('export')}
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8 text-slate-700" onClick={onFilterToggle}>
          <Filter className="mr-2 h-3 w-3" />
          {t('advanced_filters')}
        </Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={onNewPatient}>
          <UserPlus className="mr-2 h-3 w-3" />
          {t('new_patient')}
        </Button>
      </div>
    </div>
  );
}
