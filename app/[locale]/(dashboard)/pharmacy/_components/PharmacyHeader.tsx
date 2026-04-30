"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface PharmacyHeaderProps {
  onAddMedication: () => void;
}

export function PharmacyHeader({ onAddMedication }: PharmacyHeaderProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');

  return (
    <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-slate-800">{t('title')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs">{tc('print')}</Button>
        <Button variant="outline" size="sm" className="h-8 text-xs">{tc('export')}</Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={onAddMedication}>
          <Plus className="mr-2 h-3 w-3" />
          {t('add_medication')}
        </Button>
      </div>
    </div>
  );
}
