"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Search, Bed, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";

// Stub data
const stays = [
  { id: "STAY-001", stayNumber: "ADM-2025-001", patientName: "John Doe", type: "Emergency", status: "In Progress", admissionDate: new Date(), department: "ICU", bed: "ICU-04" },
  { id: "STAY-002", stayNumber: "ADM-2025-002", patientName: "Charlie Davis", type: "Scheduled", status: "In Progress", admissionDate: new Date(), department: "Surgery", bed: "SURG-12" },
  { id: "STAY-003", stayNumber: "ADM-2025-003", patientName: "Alice Johnson", type: "Outpatient", status: "Discharged", admissionDate: new Date(Date.now() - 86400000), department: "Medicine", bed: "OPD-01" },
];

export default function AdmissionsPage() {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  const tp = useTranslations('patients');
  const hasModule = useAppStore((state) => state.hasModule);
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [isNewAdmissionOpen, setIsNewAdmissionOpen] = useState(false);

  if (!hasModule('MODULE_ADMISSION')) {
    return (
      <div className="flex h-full items-center justify-center">
         <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{tc('restricted_access')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('module_desc')}</p>
            <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
               {tc('contact_admin')}
            </p>
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="text-xs h-8 text-slate-700" onClick={() => setShowFilters(!showFilters)}>
             <Filter className="mr-2 h-3 w-3" />
             {tp('advanced_filters')}
           </Button>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={() => setIsNewAdmissionOpen(true)}>
             <Bed className="mr-2 h-3 w-3" />
             {t('new_admission')}
           </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
           <div className="flex items-center justify-between">
             <div className="relative w-96">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="search"
                  placeholder={tc('search')}
                  className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-normal italic">Updated 1m ago</span>
              </div>
           </div>
           
           {showFilters && (
             <div className="flex flex-wrap items-center gap-3 pt-2 mt-1 border-t border-slate-200/60">
               <div className="flex items-center gap-2">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('status')}:</label>
                 <select className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700">
                   <option>{tc('all')}</option>
                   <option>In Progress</option>
                   <option>Discharged</option>
                   <option>Pending Transfer</option>
                 </select>
               </div>
               <div className="flex items-center gap-2">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{t('arrival_mode')}:</label>
                 <select className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700">
                   <option>{tc('all')}</option>
                   <option>Walk-In</option>
                   <option>Ambulance</option>
                   <option>Police/Escort</option>
                 </select>
               </div>
               <Button size="sm" variant="secondary" className="h-7 text-xs ml-auto">{tp('apply_filters')}</Button>
               <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={() => setShowFilters(false)}>{tp('clear')}</Button>
             </div>
           )}
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{t('stay_number')}</th>
                <th className="px-4 py-2">{tc('patient')}</th>
                <th className="px-4 py-2">{tc('priority')}</th>
                <th className="px-4 py-2">Room</th>
                <th className="px-4 py-2">Doctor</th>
                <th className="px-4 py-2">{tc('status')}</th>
                <th className="px-4 py-2 text-right">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {stays.map((stay) => (
                <tr 
                  key={stay.id} 
                  className="hover:bg-blue-50/50 cursor-pointer"
                  onClick={() => router.push(`/stays/${stay.id}`)}
                >
                  <td className="px-4 py-2 font-mono text-slate-600">{stay.stayNumber}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{stay.patientName}</td>
                  <td className="px-4 py-2">
                     <span className={cn(
                       "px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                       stay.type === 'Emergency' ? "bg-red-100 text-red-700" :
                       stay.type === 'Scheduled' ? "bg-blue-100 text-blue-700" :
                       "bg-slate-100 text-slate-700"
                     )}>
                          {stay.type}
                     </span>
                  </td>
                  <td className="px-4 py-2">{stay.bed}</td>
                  <td className="px-4 py-2 text-slate-600">--</td>
                  <td className="px-4 py-2 text-slate-600">
                     <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-semibold",
                        stay.status === 'In Progress' ? "text-orange-700 bg-orange-100" : "text-slate-600 bg-slate-100"
                     )}>
                        {stay.status}
                     </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button 
                      className="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/stays/${stay.id}`);
                      }}
                    >
                      {tc('view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <span>{t('queue_status', { count: 3, total: 42 })}</span>
          <div className="flex gap-4">
              <span className="text-blue-600 font-semibold cursor-pointer">{tc('view')} {tc('all')}</span>
              <span className="text-blue-600 font-semibold cursor-pointer">{tc('print')}</span>
          </div>
        </div>
      </div>

      <Sheet open={isNewAdmissionOpen} onOpenChange={setIsNewAdmissionOpen}>
        <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <SheetTitle className="text-lg">{t('new_admission')}</SheetTitle>
            <SheetDescription className="text-xs">
              {t('register_desc')}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('patient')}</label>
               <PatientSearchAutocomplete className="h-8 text-xs bg-white border-slate-200" />
               <button className="text-xs text-blue-600 hover:underline mt-1 font-medium">+ {tp('new_patient')}</button>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Admission Type</label>
                 <select className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                    <option>Emergency</option>
                    <option>Scheduled</option>
                    <option>Maternity</option>
                 </select>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{t('arrival_mode')}</label>
                 <select className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                    <option>Walk-In</option>
                    <option>Ambulance</option>
                    <option>Police/Escort</option>
                 </select>
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">{t('triage_priority')}</label>
               <div className="grid grid-cols-5 gap-1">
                 <button className="py-1.5 rounded border border-red-500 text-red-700 bg-red-50 hover:bg-red-100 text-[10px] font-bold">1-RES</button>
                 <button className="py-1.5 rounded border border-orange-500 text-orange-700 hover:bg-orange-50 text-[10px] font-bold bg-white">2-EMR</button>
                 <button className="py-1.5 rounded border border-yellow-500 text-yellow-700 hover:bg-yellow-50 text-[10px] font-bold bg-white">3-URG</button>
                 <button className="py-1.5 rounded border border-blue-500 text-blue-700 hover:bg-blue-50 text-[10px] font-bold bg-white">4-L-URG</button>
                 <button className="py-1.5 rounded border border-green-500 text-green-700 hover:bg-green-50 text-[10px] font-bold bg-white">5-NON</button>
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">{t('chief_complaint')}</label>
               <textarea 
                  className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                  placeholder="Patient reports chest pain..."
               />
             </div>
             
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">Assigned Department (Optional)</label>
               <select className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">Unassigned</option>
                  <option>Emergency Room (ER)</option>
                  <option>ICU</option>
                  <option>Cardiology</option>
               </select>
             </div>
          </div>
          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
            <Button variant="outline" className="text-xs h-8" onClick={() => setIsNewAdmissionOpen(false)}>{tc('cancel')}</Button>
            <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700">{t('new_admission')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
