"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRightLeft,
  Activity,
  BedDouble,
  FilePlus2,
  LogOut,
  Printer,
  Siren,
  User,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { format } from "date-fns";
import { TriageBadge } from "@/components/shared/triage-badge";
import { StayPhaseBadge } from "@/components/shared/stay-phase-badge";
import { isVitalEmergencyTriage } from "@/components/shared/medical-act-select";
import { StayDetail } from "../types";

interface StayHeaderProps {
  stay: StayDetail;
  onTransferOpen: () => void;
  onDischargeOpen: () => void;
  onVitalsOpen: () => void;
  onRetriageOpen: () => void;
  onHospitalizeOpen: () => void;
  onCancelHospitalization: () => void;
  onNoteOpen: () => void;
  onPrint: () => void;
}

const headerButton = "text-xs h-10 md:h-9 w-full md:w-auto rounded-lg px-3 md:px-4 border-slate-200 hover:bg-slate-50 transition-colors";

export function StayHeader({
  stay,
  onTransferOpen,
  onDischargeOpen,
  onVitalsOpen,
  onRetriageOpen,
  onHospitalizeOpen,
  onCancelHospitalization,
  onNoteOpen,
  onPrint,
}: StayHeaderProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  // Hospitalisation follows a signed consultation (a vital emergency doesn't wait for it).
  const canHospitalize =
    stay.status === 'in_progress' &&
    !stay.hospitalization &&
    (stay.consultationStatus === 'completed' || isVitalEmergencyTriage(stay.type, stay.triageAcuity ?? ''));

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0 bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-start md:items-center gap-3 md:gap-4 min-w-0">
        <Link href="/stays" className="p-2 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 text-slate-500 transition-all active:scale-95">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{stay.stayNumber}</h1>
            <StayPhaseBadge
              stay={{ status: stay.status, consultationStatus: stay.consultationStatus, hospitalizationStatus: stay.hospitalization?.status }}
              className="px-2.5 rounded-full uppercase font-bold tracking-wider"
            />
            <span className={cn(
                "px-2.5 py-0.5 text-[10px] rounded-full uppercase font-bold tracking-wider",
                stay.type === 'emergency' ? "bg-red-100 text-red-700 ring-1 ring-red-200" :
                stay.type === 'scheduled' ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200" :
                "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
            )}>
              {t(`type_${stay.type}`)}
            </span>
            {stay.type === 'emergency' && stay.triageAcuity && (
              <TriageBadge acuity={stay.triageAcuity} className="rounded-full ring-1 ring-black/5" />
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5"><User className="h-3 w-3" /> {stay.patient.firstName} {stay.patient.lastName}</span>
            <span className="hidden md:inline text-slate-300">|</span>
            <span>{tc('date')}: {format(new Date(stay.admissionDate), "MMM d, yyyy HH:mm")}</span>
          </div>
          {stay.hospitalization && (
            <div className={cn(
              "mt-2 inline-flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium",
              stay.hospitalization.status === "admitted" ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
            )}>
              <BedDouble className="h-3.5 w-3.5" />
              {stay.hospitalization.status === "admitted"
                ? t('hospitalized_in', { department: stay.hospitalization.departmentName ?? "—", bed: stay.hospitalization.bedLabel ?? "—" })
                : t('hospitalization_pending', { department: stay.hospitalization.departmentName ?? "—", bed: stay.hospitalization.bedLabel ?? "—" })}
              {stay.hospitalization.status === "awaiting_payment" && (
                <button type="button" onClick={onCancelHospitalization} className="inline-flex items-center gap-0.5 text-amber-900 underline-offset-2 hover:underline">
                  <X className="h-3 w-3" /> {tc('cancel')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
         <Button variant="outline" size="sm" className={headerButton} onClick={onPrint}>
           <Printer className="mr-2 h-3.5 w-3.5 text-slate-500" />
           {t('print_medical_record')}
         </Button>
         {stay.status === 'in_progress' && (
           <Button variant="outline" size="sm" className={headerButton} onClick={onNoteOpen}>
             <FilePlus2 className="mr-2 h-3.5 w-3.5 text-slate-500" />
             {t('complementary_note')}
           </Button>
         )}
         {canHospitalize && (
           <Button size="sm" className="text-xs h-10 md:h-9 w-full md:w-auto rounded-lg px-3 md:px-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={onHospitalizeOpen}>
             <BedDouble className="mr-2 h-3.5 w-3.5" />
             {t('hospitalize')}
           </Button>
         )}
         {stay.status !== 'discharged' && (
           <Button variant="outline" size="sm" className="text-xs h-10 md:h-9 w-full md:w-auto rounded-lg px-3 md:px-4 border-slate-200 hover:bg-slate-50 transition-colors" onClick={onVitalsOpen}>
             <Activity className="mr-2 h-3.5 w-3.5 text-slate-500" />
             {t('add_vitals')}
           </Button>
         )}
         {stay.type === 'emergency' && stay.status === 'in_progress' && (
           <Button variant="outline" size="sm" className="text-xs h-10 md:h-9 w-full md:w-auto rounded-lg px-3 md:px-4 border-slate-200 hover:bg-slate-50 transition-colors" onClick={onRetriageOpen}>
             <Siren className="mr-2 h-3.5 w-3.5 text-slate-500" />
             {t('retriage')}
           </Button>
         )}
         <Button variant="outline" size="sm" className="text-xs h-10 md:h-9 w-full md:w-auto rounded-lg px-3 md:px-4 border-slate-200 hover:bg-slate-50 transition-colors" onClick={onTransferOpen}>
           <ArrowRightLeft className="mr-2 h-3.5 w-3.5 text-slate-500" />
           {t('transfer_bed')}
         </Button>
         {stay.status !== 'discharged' && (
           <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-10 md:h-9 w-full md:w-auto rounded-lg px-4 shadow-sm transition-all active:scale-95 max-md:col-span-2" onClick={onDischargeOpen}>
             <LogOut className="mr-2 h-3.5 w-3.5" />
             {t('discharge_patient')}
           </Button>
         )}
      </div>
    </div>
  );
}
