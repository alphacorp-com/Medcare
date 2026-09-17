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
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Link href="/patients" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">{patient.firstName} {patient.lastName}</h1>
              <span className={cn(
                "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                patient.isDeceased ? "bg-slate-200 text-slate-700" : "bg-green-100 text-green-700"
              )}>
                {patient.isDeceased ? t('status_deceased') : tc('status_active')}
              </span>
              {patient.allergies?.length > 0 && (
                <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                  <ShieldAlert className="h-3 w-3" /> {t('allergies')}
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
              <span className="font-mono">IPP: {patient.ipp}</span>
              {patient.nss && <><span className="text-slate-300">•</span><span>NSS: <span className="font-mono">{patient.nss}</span></span></>}
              <span className="text-slate-300">•</span>
              <span>{dobLabel}</span>
            </div>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
          <Button variant="outline" size="sm" className="h-10 w-full justify-center rounded-xl border-slate-200 bg-white text-xs text-slate-600 sm:w-auto" onClick={onExport}>
            <FileText className="mr-2 h-3 w-3" />
            {tc('export')}
          </Button>
          <Button variant="outline" size="sm" className="h-10 w-full justify-center rounded-xl border-slate-200 bg-white text-xs text-slate-600 sm:w-auto" onClick={onEdit}>
            <Edit className="mr-2 h-3 w-3" />
            {tc('edit')}
          </Button>
          <Button size="sm" className="h-10 w-full justify-center rounded-xl bg-blue-600 text-xs text-white hover:bg-blue-700 sm:w-auto" onClick={onNewAdmission}>
            {tc('new_admission')}
          </Button>
        </div>
      </div>
    </div>
  );
}
