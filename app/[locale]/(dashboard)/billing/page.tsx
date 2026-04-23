"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, Filter, Receipt, FileCheck, Banknote, AlertCircle, FileDigit, Code, FileText, Download, Check, X, Printer, Mail
} from "lucide-react";

// Stub Data for billing dossiers
const billingStays = [
  { id: "BIL-2025-001", stayId: "ADM-2025-001", patientName: "John Doe", ipp: "100000123", dischargeDate: new Date(), type: "Emergency", status: "To Code", amount: 0, pmsiCode: null },
  { id: "BIL-2025-002", stayId: "ADM-2025-002", patientName: "Charlie Davis", ipp: "100000127", dischargeDate: new Date(Date.now() - 86400000), type: "Surgery", status: "To Validate (DIM)", amount: 1450.50, pmsiCode: "08C421" },
  { id: "BIL-2025-003", stayId: "ADM-2025-003", patientName: "Alice Johnson", ipp: "100000125", dischargeDate: new Date(Date.now() - 172800000), type: "Outpatient", status: "Ready to Bill", amount: 150.00, pmsiCode: "Z01.8" },
  { id: "BIL-2025-004", stayId: "ADM-2025-004", patientName: "Bob Brown", ipp: "100000126", dischargeDate: new Date(Date.now() - 432000000), type: "Medicine", status: "Billed", amount: 3200.00, pmsiCode: "I21.9" }
];

export default function BillingPage() {
  const t = useTranslations('billing');
  const tc = useTranslations('common');
  const hasModule = useAppStore((state) => state.hasModule);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedDossier, setSelectedDossier] = useState<any>(null);
  const [isCodingModalOpen, setIsCodingModalOpen] = useState(false);

  const handleExportCSV = () => {
     let csvContent = [
      [`Organization: ${tc('app_name')} HMS`, "123 Health Ave", "+1 234 567 8900", ""],
      [""],
      ["Bill ID", "Stay ID", tc('patient'), tc('ipp'), "Type", tc('status'), t('amount'), t('pmsi_code'), tc('date')]
     ];
     filteredStays.forEach(s => {
       csvContent.push([s.id, s.stayId, `"${s.patientName}"`, s.ipp, s.type, s.status, s.amount.toString(), s.pmsiCode || "", s.dischargeDate.toISOString()]);
     });
     const blob = new Blob([csvContent.map(e => e.join(",")).join("\n")], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = `billing_export_${format(new Date(), 'yyyyMMdd')}.csv`;
     link.click();
  };

  const handlePrint = () => {
      window.print();
  };

  if (!hasModule("MODULE_BILLING")) {
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

  const filteredStays = billingStays.filter(stay => {
    if (filter !== "All" && stay.status !== filter) return false;
    if (search && !stay.patientName.toLowerCase().includes(search.toLowerCase()) && !stay.stayId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
           <a href={`mailto:?subject=Billing Export&body=Please find the attached billing reports.%0A%0AOrganization: MedCore HMS%0A123 Health Ave, Medical City`} className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
             <Mail className="h-3.5 w-3.5 mr-2" /> Email
           </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("To Code")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('to_code')}</div>
            <div className="text-3xl font-bold text-slate-900">{billingStays.filter(e => e.status === 'To Code').length}</div>
          </div>
          <Code className="h-8 w-8 text-slate-200" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("To Validate (DIM)")}>
          <div>
            <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-1">{t('dim_validation')}</div>
            <div className="text-3xl font-bold text-yellow-600">{billingStays.filter(e => e.status === 'To Validate (DIM)').length}</div>
          </div>
          <FileCheck className="h-8 w-8 text-yellow-100" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Ready to Bill")}>
          <div>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">{t('ready_to_bill')}</div>
            <div className="text-3xl font-bold text-green-600">{billingStays.filter(e => e.status === 'Ready to Bill').length}</div>
          </div>
          <Receipt className="h-8 w-8 text-green-100" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Billed")}>
          <div>
             <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">{t('invoices_generated')}</div>
             <div className="text-3xl font-bold text-blue-700">{billingStays.filter(e => e.status === 'Billed').length}</div>
          </div>
          <Banknote className="h-8 w-8 text-blue-100" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
           <div className="relative w-96 flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder={tc('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
              />
            </div>
            <div className="flex bg-slate-200/50 p-1 rounded-md ml-4">
              <button onClick={() => setFilter("All")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "All" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{tc('all')}</button>
              <button onClick={() => setFilter("To Code")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "To Code" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('to_code')}</button>
              <button onClick={() => setFilter("To Validate (DIM)")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "To Validate (DIM)" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>DIM Validate</button>
              <button onClick={() => setFilter("Ready to Bill")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "Ready to Bill" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('ready_to_bill')}</button>
            </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{t('stay_record')}</th>
                <th className="px-4 py-2">{tc('patient')}</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">{tc('date')}</th>
                <th className="px-4 py-2">{t('pmsi_code')}</th>
                <th className="px-4 py-2 text-right">{t('amount')}</th>
                <th className="px-4 py-2">{tc('status')}</th>
                <th className="px-4 py-2 text-right">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredStays.map((stay) => (
                <tr key={stay.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => setSelectedDossier(stay)}>
                  <td className="px-4 py-2 font-mono text-slate-600">
                    <div>{stay.stayId}</div>
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {stay.patientName} <span className="text-[10px] font-mono text-slate-400">({stay.ipp})</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{stay.type}</td>
                  <td className="px-4 py-2 text-slate-500">{format(stay.dischargeDate, "MMM dd, yyyy")}</td>
                  <td className="px-4 py-2 font-mono text-slate-900 font-semibold">{stay.pmsiCode || <span className="text-slate-400 font-normal">Pending</span>}</td>
                  <td className="px-4 py-2 text-right font-mono">{stay.amount > 0 ? `$${stay.amount.toFixed(2)}` : '--'}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                       "px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center w-fit",
                       stay.status === 'To Code' ? "bg-slate-100 text-slate-700" :
                       stay.status === 'To Validate (DIM)' ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
                       stay.status === 'Ready to Bill' ? "bg-green-100 text-green-700 border border-green-200" :
                       "bg-blue-100 text-blue-700"
                    )}>
                      {stay.status === 'Ready to Bill' && <Check className="h-3 w-3 mr-1" />}
                      {stay.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button 
                       className={cn(
                          "font-semibold px-3 py-1 rounded text-[11px]",
                          stay.status === 'To Code' ? "bg-slate-800 text-white hover:bg-slate-900" :
                          stay.status === 'To Validate (DIM)' ? "bg-yellow-500 text-white hover:bg-yellow-600" :
                          stay.status === 'Ready to Bill' ? "bg-green-600 text-white hover:bg-green-700" :
                          "text-blue-600 hover:bg-blue-50"
                       )}
                       onClick={(e) => { e.stopPropagation(); setSelectedDossier(stay); }}
                    >
                      {stay.status === 'To Code' ? t('enter_codes') : 
                       stay.status === 'To Validate (DIM)' ? t('review_dim') : 
                       stay.status === 'Ready to Bill' ? t('generate_invoice') : tc('view')}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStays.length === 0 && (
                <tr>
                   <td colSpan={8} className="text-center py-8 text-slate-500 text-xs">{tc('no_data')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Action Sheet */}
      <Sheet open={!!selectedDossier} onOpenChange={(open) => !open && setSelectedDossier(null)}>
        {selectedDossier && (
           <SheetContent className="sm:max-w-2xl w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
             <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
               <div className="flex items-start justify-between">
                 <div>
                   <SheetTitle className="text-lg flex items-center gap-2">
                     Billing Record
                     <span className={cn(
                         "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                         selectedDossier.status === 'To Code' ? "bg-slate-100 text-slate-700" :
                         selectedDossier.status === 'To Validate (DIM)' ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
                         selectedDossier.status === 'Ready to Bill' ? "bg-green-100 text-green-700 border border-green-200" :
                         "bg-blue-100 text-blue-700"
                      )}>
                        {selectedDossier.status}
                      </span>
                   </SheetTitle>
                   <SheetDescription className="text-xs mt-1">
                     <span className="font-mono">ID: {selectedDossier.id}</span> &bull; Attached to Stay: {selectedDossier.stayId}
                   </SheetDescription>
                 </div>
               </div>
             </SheetHeader>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                       {selectedDossier.patientName.charAt(0)}
                     </div>
                     <div>
                       <div className="text-sm font-bold text-slate-900">{selectedDossier.patientName}</div>
                       <div className="text-[10px] font-mono text-slate-500">IPP: {selectedDossier.ipp}</div>
                     </div>
                   </div>
                   <Button variant="outline" size="sm" className="text-xs h-7">View Full Medical Record</Button>
                </div>
                
                {selectedDossier.status === 'To Code' && (
                  <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
                     <FileDigit className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                     <h3 className="text-sm font-bold text-slate-800">Coding Required</h3>
                     <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">This stay has been discharged and is awaiting specific PMSI/Medical Coding to calculate billing.</p>
                     <Button className="mt-4 text-xs h-8 bg-slate-900" onClick={() => setIsCodingModalOpen(true)}>
                       Enter PMSI Code
                     </Button>
                  </div>
                )}

                {(selectedDossier.status === 'To Validate (DIM)' || selectedDossier.status === 'Ready to Bill' || selectedDossier.status === 'Billed') && (
                  <>
                  <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden p-4">
                     <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">PMSI Data Submitted</div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[10px] text-slate-500 block mb-0.5">Primary Diagnosis Code (DP)</label>
                           <div className="text-lg font-mono font-bold text-slate-800">{selectedDossier.pmsiCode}</div>
                        </div>
                        <div>
                           <label className="text-[10px] text-slate-500 block mb-0.5">Calculated Base Group (GHM/DRG)</label>
                           <div className="text-sm font-semibold text-slate-800">Level 2 Severity</div>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden p-0">
                     <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Financial Simulation</div>
                     </div>
                     <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100">
                        <span className="text-xs font-semibold text-slate-600">Base Medical Fee (GHM)</span>
                        <span className="text-sm font-mono font-bold text-slate-900">${(selectedDossier.amount * 0.8).toFixed(2)}</span>
                     </div>
                     <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100">
                        <span className="text-xs font-semibold text-slate-600">Consumables & Lab Overhead</span>
                        <span className="text-sm font-mono font-bold text-slate-900">${(selectedDossier.amount * 0.2).toFixed(2)}</span>
                     </div>
                     <div className="p-4 flex justify-between items-center bg-slate-50">
                        <span className="text-sm font-bold text-slate-900">Total Invoice Amount</span>
                        <span className="text-xl font-mono font-bold text-blue-700">${selectedDossier.amount.toFixed(2)}</span>
                     </div>
                  </div>
                  </>
                )}
             </div>
             
             <SheetFooter className="p-4 border-t border-slate-200 bg-slate-100 shrink-0 justify-between items-center flex-row">
                 <Button variant="ghost" size="sm" className="text-xs text-slate-600 hover:text-slate-900">
                    <FileText className="mr-2 h-4 w-4" /> View Stay Summary
                 </Button>
                 
                 <div className="flex gap-2">
                    {selectedDossier.status === 'To Validate (DIM)' && (
                       <>
                         <Button variant="outline" className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                           <X className="mr-2 h-3.5 w-3.5" /> Reject Coding
                         </Button>
                         <Button className="text-xs h-8 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => setSelectedDossier({...selectedDossier, status: 'Ready to Bill'})}>
                           <FileCheck className="mr-2 h-3.5 w-3.5" /> DIM Validate
                         </Button>
                       </>
                    )}
                    {selectedDossier.status === 'Ready to Bill' && (
                       <Button className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => setSelectedDossier({...selectedDossier, status: 'Billed'})}>
                         <Receipt className="mr-2 h-3.5 w-3.5" /> Generate Patient Invoice
                       </Button>
                    )}
                    {selectedDossier.status === 'Billed' && (
                       <Button variant="outline" className="text-xs h-8 bg-white" onClick={() => {}}>
                         <Download className="mr-2 h-3.5 w-3.5 text-blue-600" /> Download PDF Invoice
                       </Button>
                    )}
                 </div>
             </SheetFooter>
           </SheetContent>
        )}
      </Sheet>

      {/* Enter PMSI Code Modal */}
      <Dialog open={isCodingModalOpen} onOpenChange={setIsCodingModalOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden flex flex-col gap-0 border-0 outline-none">
           <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-slate-50 space-y-0">
              <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                 <Code className="h-4 w-4 text-slate-600" /> Enter Medical Codes (PMSI)
              </DialogTitle>
              {/* <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCodingModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button> */}
           </DialogHeader>
           <div className="p-4 overflow-y-auto space-y-4 max-h-[80vh]">
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Primary Diagnosis (DP)</label>
                 <Input placeholder="e.g. I21.9" className="h-9 text-xs font-mono uppercase bg-slate-50" />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Associated/Comorbidities (DR/DAS)</label>
                 <Input placeholder="Comma separated codes" className="h-9 text-xs font-mono uppercase" />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Acts / Procedures (CCAM)</label>
                 <Input placeholder="Enter CCAM codes" className="h-9 text-xs font-mono uppercase" />
              </div>
           </div>
           <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsCodingModalOpen(false)} className="text-xs h-8">Cancel</Button>
              <Button size="sm" onClick={() => {
                 setIsCodingModalOpen(false);
                 setSelectedDossier({...selectedDossier, status: 'To Validate (DIM)', pmsiCode: 'I21.9', amount: Math.floor(Math.random() * 5000) + 500});
              }} className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8">Save Codes</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
