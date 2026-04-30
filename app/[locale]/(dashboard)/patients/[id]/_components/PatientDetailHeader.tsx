"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, FileText, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { PatientDetail, ageFromBirthDate } from "../types";

interface PatientDetailHeaderProps {
  patient: PatientDetail;
  onExport: () => void;
  onEdit: () => void;
  onNewAdmission: () => void;
}

export function PatientDetailHeader({
  patient,
  onExport,
  onEdit,
  onNewAdmission,
}: PatientDetailHeaderProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');

  const age = ageFromBirthDate(patient.birthDate);
  const dobLabel = `${format(new Date(patient.birthDate), "yyyy-MM-dd")} (${age} ${t('age_years', { age })})`;

  return (
    <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
      <div className="flex items-center gap-4">
        <Link href="/patients" className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 text-slate-500 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{patient.firstName} {patient.lastName}</h1>
            <span className={cn(
              "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
              patient.isDeceased ? "bg-slate-200 text-slate-700" : "bg-green-100 text-green-700"
            )}>
              {patient.isDeceased ? t('status_deceased') : tc('status_active')}
            </span>
            {patient.allergies?.length > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded uppercase font-semibold flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> {t('allergies')}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
            <span className="font-mono">IPP: {patient.ipp}</span>
            {patient.nss && <><span>&bull;</span><span>NSS: <span className="font-mono">{patient.nss}</span></span></>}
            <span>&bull;</span>
            <span>{dobLabel}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="text-xs h-8 text-slate-600" onClick={onExport}>
          <FileText className="mr-2 h-3 w-3" />
          {tc('export')}
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8 text-slate-600" onClick={onEdit}>
          <Edit className="mr-2 h-3 w-3" />
          {tc('edit')}
        </Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={onNewAdmission}>
          {tc('new_admission')}
        </Button>
      </div>
    </div>
  );
}
