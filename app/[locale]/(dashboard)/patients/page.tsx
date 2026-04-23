"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Plus, Filter, UserPlus, Printer, Download, Mail, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import { useState } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { useTranslations } from "next-intl";

// Stub data
const patients = [
  { id: "PAT-001", ipp: "100000123", name: "John Doe", gender: "M", dob: "1980-05-15", status: "Active" },
  { id: "PAT-002", ipp: "100000124", name: "Jane Smith", gender: "F", dob: "1992-11-20", status: "Discharged" },
  { id: "PAT-003", ipp: "100000125", name: "Alice Johnson", gender: "F", dob: "1975-02-03", status: "Active" },
  { id: "PAT-004", ipp: "100000126", name: "Bob Brown", gender: "M", dob: "2001-08-30", status: "Transfer" },
  { id: "PAT-005", ipp: "100000127", name: "Charlie Davis", gender: "M", dob: "1960-12-10", status: "Active" },
];

export default function PatientsPage() {
  const hasModule = useAppStore((state) => state.hasModule);
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);

  const handleExportCSV = () => {
     let csvContent = [
      [`Organization: ${tc('app_name')}`, "123 Health Ave", "", ""],
      [""],
      [tc('ipp'), tc('name'), tc('gender'), tc('dob'), tc('status')]
     ];
     patients.forEach(p => {
       csvContent.push([p.ipp, `"${p.name}"`, p.gender, p.dob, p.status]);
     });
     const blob = new Blob([csvContent.map(e => e.join(",")).join("\n")], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = `patient_directory_export_${format(new Date(), 'yyyyMMdd')}.csv`;
     link.click();
  };

  const handlePrint = () => {
      window.print();
  };

  if (!hasModule('MODULE_CORE_PATIENT')) {
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
           <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-2" /> {tc('print')}</Button>
           <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportCSV}><Download className="h-3.5 w-3.5 mr-2" /> {tc('export')}</Button>
           <Button variant="outline" size="sm" className="text-xs h-8 text-slate-700" onClick={() => setShowFilters(!showFilters)}>
             <Filter className="mr-2 h-3 w-3" />
             {t('advanced_filters')}
           </Button>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={() => setIsNewPatientOpen(true)}>
             <UserPlus className="mr-2 h-3 w-3" />
             {t('new_patient')}
           </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
           <div className="flex items-center">
             <div className="relative w-96">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="search"
                  placeholder={t('search_placeholder')}
                  className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
                />
              </div>
           </div>
           
           {showFilters && (
             <div className="flex flex-wrap items-center gap-3 pt-2 mt-1 border-t border-slate-200/60">
               <div className="flex items-center gap-2">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('status')}:</label>
                 <select className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700">
                   <option>{tc('all')}</option>
                   <option>Active</option>
                   <option>Discharged</option>
                   <option>Transfer</option>
                 </select>
               </div>
               <Button size="sm" variant="secondary" className="h-7 text-xs ml-auto">{t('apply_filters')}</Button>
               <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={() => setShowFilters(false)}>{t('clear')}</Button>
             </div>
           )}
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{tc('ipp')}</th>
                <th className="px-4 py-2">{tc('name')}</th>
                <th className="px-4 py-2">{tc('gender')}</th>
                <th className="px-4 py-2">{tc('dob')}</th>
                <th className="px-4 py-2">{tc('status')}</th>
                <th className="px-4 py-2 text-right">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {patients.map((patient) => (
                <tr 
                  key={patient.id} 
                  className="hover:bg-blue-50/50 cursor-pointer"
                  onClick={() => router.push(`/patients/${patient.id}`)}
                >
                  <td className="px-4 py-2 font-mono text-slate-600">{patient.ipp}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{patient.name}</td>
                  <td className="px-4 py-2">{patient.gender}</td>
                  <td className="px-4 py-2">{patient.dob}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                       "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                       patient.status === 'Active' ? "bg-green-100 text-green-700" :
                       patient.status === 'Transfer' ? "bg-yellow-100 text-yellow-700" :
                       "bg-slate-100 text-slate-600"
                    )}>
                      {patient.status === 'Active' ? tc('status_active') : 
                       patient.status === 'Transfer' ? tc('status_transfer') : 
                       tc('status_discharged')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button 
                      className="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/patients/${patient.id}`);
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
          <span>{t('showing_total', { count: patients.length })}</span>
        </div>
      </div>

      <Sheet open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <SheetTitle className="text-lg">{t('register_title')}</SheetTitle>
            <SheetDescription className="text-xs">
              {t('register_desc')}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 flex-1 overflow-y-auto space-y-6">
             {/* Demographics */}
             <div className="space-y-3">
               <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('demographics')}</h4>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('first_name')} *</label>
                   <Input placeholder="eg. John" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('last_name')} *</label>
                   <Input placeholder="eg. Doe" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('dob')} *</label>
                   <Input type="date" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 text-slate-700" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('gender')} *</label>
                   <select className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Select...</option>
                      <option>{t('gender_male')}</option>
                      <option>{t('gender_female')}</option>
                      <option>{t('gender_other')}</option>
                   </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('ssn')}</label>
                   <Input placeholder="Optional" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 font-mono" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('blood_group')}</label>
                   <select className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Unknown</option>
                      <option>O+</option><option>O-</option>
                      <option>A+</option><option>A-</option>
                      <option>B+</option><option>B-</option>
                      <option>AB+</option><option>AB-</option>
                   </select>
                 </div>
               </div>
             </div>

             {/* Contact Info */}
             <div className="space-y-3">
               <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('contact_info')}</h4>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
                 <Input type="tel" placeholder="+1 (555) 000-0000" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('email')}</label>
                 <Input type="email" placeholder="patient@example.com" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('address')}</label>
                 <textarea 
                    className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                    placeholder="123 Main St, City, Country"
                 />
               </div>
             </div>

             {/* Emergency Contact */}
             <div className="space-y-3">
               <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('emergency_contact')}</h4>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('name')}</label>
                   <Input placeholder="Contact Name" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('relationship')}</label>
                   <select className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Select...</option>
                      <option>Spouse</option>
                      <option>Child</option>
                      <option>Parent</option>
                      <option>Sibling</option>
                      <option>Other</option>
                   </select>
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
                 <Input type="tel" placeholder="+1..." className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
               </div>
             </div>
          </div>
          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <Button variant="outline" className="text-xs h-8" onClick={() => setIsNewPatientOpen(false)}>{tc('cancel')}</Button>
            <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700">{t('save_record')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
