"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRightLeft,
  Activity,
  LogOut,
  Siren,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { format } from "date-fns";
import { TriageBadge } from "@/components/shared/triage-badge";
import { StayDetail } from "../types";

interface StayHeaderProps {
  stay: StayDetail;
  onTransferOpen: () => void;
  onDischargeOpen: () => void;
  onVitalsOpen: () => void;
  onRetriageOpen: () => void;
}

export function StayHeader({ stay, onTransferOpen, onDischargeOpen, onVitalsOpen, onRetriageOpen }: StayHeaderProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');

  return (
    <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-4">
        <Link href="/stays" className="p-2 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 text-slate-500 transition-all active:scale-95">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{stay.stayNumber}</h1>
            <span className={cn(
                "px-2.5 py-0.5 text-[10px] rounded-full uppercase font-bold tracking-wider",
                stay.status === 'in_progress' ? "bg-orange-100 text-orange-700 ring-1 ring-orange-200" :
                stay.status === 'discharged' ? "bg-green-100 text-green-700 ring-1 ring-green-200" :
                "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            )}>
              {stay.status.replace('_', ' ')}
            </span>
            <span className={cn(
                "px-2.5 py-0.5 text-[10px] rounded-full uppercase font-bold tracking-wider",
                stay.type === 'emergency' ? "bg-red-100 text-red-700 ring-1 ring-red-200" :
                stay.type === 'scheduled' ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200" :
                "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
            )}>
              {stay.type}
            </span>
            {stay.type === 'emergency' && stay.triageAcuity && (
              <TriageBadge acuity={stay.triageAcuity} className="rounded-full ring-1 ring-black/5" />
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5"><User className="h-3 w-3" /> {stay.patient.firstName} {stay.patient.lastName}</span>
            <span className="text-slate-300">|</span>
            <span>{tc('date')}: {format(new Date(stay.admissionDate), "MMM d, yyyy HH:mm")}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
         {stay.status !== 'discharged' && (
           <Button variant="outline" size="sm" className="text-xs h-9 rounded-lg px-4 border-slate-200 hover:bg-slate-50 transition-colors" onClick={onVitalsOpen}>
             <Activity className="mr-2 h-3.5 w-3.5 text-slate-500" />
             {t('add_vitals')}
           </Button>
         )}
         {stay.type === 'emergency' && stay.status === 'in_progress' && (
           <Button variant="outline" size="sm" className="text-xs h-9 rounded-lg px-4 border-slate-200 hover:bg-slate-50 transition-colors" onClick={onRetriageOpen}>
             <Siren className="mr-2 h-3.5 w-3.5 text-slate-500" />
             {t('retriage')}
           </Button>
         )}
         <Button variant="outline" size="sm" className="text-xs h-9 rounded-lg px-4 border-slate-200 hover:bg-slate-50 transition-colors" onClick={onTransferOpen}>
           <ArrowRightLeft className="mr-2 h-3.5 w-3.5 text-slate-500" />
           {t('transfer_bed')}
         </Button>
         {stay.status !== 'discharged' && (
           <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-9 rounded-lg px-4 shadow-sm transition-all active:scale-95" onClick={onDischargeOpen}>
             <LogOut className="mr-2 h-3.5 w-3.5" />
             {t('discharge_patient')}
           </Button>
         )}
      </div>
    </div>
  );
}
