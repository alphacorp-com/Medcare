"use client";

import { useTranslations } from "next-intl";
import { 
  MapPin, 
  LogOut,
  Building2
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Department, StayDetail } from "../types";

interface AdmissionInfoProps {
  stay: StayDetail;
  departments: Department[];
  doctorName: string;
}

export function AdmissionInfo({ stay, departments, doctorName }: AdmissionInfoProps) {
  const t = useTranslations('admissions');

  return (
    <div className="col-span-3 flex flex-col gap-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
          <span>{t('admission_details')}</span>
          <Building2 className="h-3 w-3" />
        </div>
        <div className="space-y-4">
          <div>
            <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1.5 font-medium uppercase tracking-tight"><MapPin className="h-3 w-3 text-slate-400" /> {t('location')}</div>
            <div className="text-xs font-bold text-slate-900 border border-slate-100 bg-slate-50/50 rounded-lg px-3 py-2 mt-1.5 flex items-center gap-2">
              <span className="text-slate-700">{stay.departmentId ? departments.find(d => d.id === stay.departmentId)?.name || stay.departmentId : t('unassigned')}</span>
              {stay.bedId && <><span className="text-slate-300">/</span> <span className="text-blue-600">{stay.bedId}</span></>}
            </div>
          </div>
          <Separator className="bg-slate-100" />
          <div>
            <div className="text-[10px] text-slate-500 mb-1 font-medium uppercase tracking-tight">{t('chief_complaint')}</div>
            <div className="text-xs font-semibold text-slate-800 leading-relaxed">{stay.admissionReason || "—"}</div>
          </div>
          <Separator className="bg-slate-100" />
          <div>
            <div className="text-[10px] text-slate-500 mb-1 font-medium uppercase tracking-tight flex items-center gap-1.5">{t('attending_doctor_label')}</div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2 mt-1">
              <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 uppercase">
                {doctorName.charAt(0)}
              </div>
              <span>{doctorName}</span>
            </div>
          </div>
        </div>
      </div>

      {stay.dischargeSummary && (
        <div className="bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm p-5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-3 flex items-center gap-2">
            <LogOut className="h-3 w-3" />
            {t('discharge_summary')}
          </div>
          <p className="text-xs text-blue-900 font-medium leading-relaxed whitespace-pre-wrap">{stay.dischargeSummary}</p>
        </div>
      )}
    </div>
  );
}
