"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, Filter, FlaskConical, AlertTriangle, Check, X, Printer, Activity, Plus, FileSignature, Edit3, ClipboardList
} from "lucide-react";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";

// Stub Data
const exams = [
  { id: "EXM-1001", patientName: "John Doe", ipp: "100000123", prescriber: "Dr. S. Chen", date: new Date(), type: "Complete Blood Count (CBC)", status: "Pending Sample", priority: "Routine", critical: false },
  { id: "EXM-1002", patientName: "Charlie Davis", ipp: "100000127", prescriber: "Dr. A. Thorne", date: new Date(Date.now() - 3600000), type: "Comprehensive Metabolic Panel", status: "In Analysis", priority: "Urgent", critical: false },
  { id: "EXM-1003", patientName: "Alice Johnson", ipp: "100000125", prescriber: "Dr. Kelly", date: new Date(Date.now() - 7200000), type: "Troponin I", status: "Awaiting Validation", priority: "STAT", critical: true },
  { id: "EXM-1004", patientName: "Bob Brown", ipp: "100000126", prescriber: "Dr. Davis", date: new Date(Date.now() - 86400000), type: "Lipid Panel", status: "Completed", priority: "Routine", critical: false }
];

export default function LaboratoryPage() {
  const t = useTranslations('lab');
  const tc = useTranslations('common');
  const tp = useTranslations('patients');
  const hasModule = useAppStore((state) => state.hasModule);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [isResultEntryOpen, setIsResultEntryOpen] = useState(false);
  const [isNewExamOpen, setIsNewExamOpen] = useState(false);

  if (!hasModule("MODULE_LAB")) {
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

  const filteredExams = exams.filter(ex => {
    if (filter === "Critical" && !ex.critical) return false;
    if (filter !== "All" && filter !== "Critical" && ex.status !== filter) return false;
    if (search && !ex.patientName.toLowerCase().includes(search.toLowerCase()) && !ex.id.toLowerCase().includes(search.toLowerCase())) return false;
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
           <Button onClick={() => setIsNewExamOpen(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
             <Plus className="mr-2 h-3.5 w-3.5" /> Prescribe Exam
           </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Pending Sample")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('samples')}</div>
            <div className="text-3xl font-bold text-slate-900">{exams.filter(e => e.status === 'Pending Sample').length}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("In Analysis")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">In Analysis</div>
            <div className="text-3xl font-bold text-slate-900">{exams.filter(e => e.status === 'In Analysis').length}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Awaiting Validation")}>
          <div>
            <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-1">{t('pending_results')}</div>
            <div className="text-3xl font-bold text-yellow-600">{exams.filter(e => e.status === 'Awaiting Validation').length}</div>
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded border border-red-200 shadow-sm flex items-end justify-between hover:border-red-300 transition-colors cursor-pointer" onClick={() => setFilter("Critical")}>
          <div>
             <div className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">Critical Results</div>
             <div className="text-3xl font-bold text-red-700">{exams.filter(e => e.critical).length}</div>
          </div>
          <AlertTriangle className="h-8 w-8 text-red-200" />
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
              <button onClick={() => setFilter("Pending Sample")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "Pending Sample" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('samples')}</button>
              <button onClick={() => setFilter("In Analysis")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "In Analysis" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>Analysis</button>
              <button onClick={() => setFilter("Awaiting Validation")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "Awaiting Validation" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('pending_results')}</button>
            </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">Exam ID</th>
                <th className="px-4 py-2">{tc('patient')}</th>
                <th className="px-4 py-2">Prescriber</th>
                <th className="px-4 py-2">Test Type</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">{tc('status')}</th>
                <th className="px-4 py-2 text-right">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredExams.map((ex) => (
                <tr key={ex.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => setSelectedExam(ex)}>
                  <td className="px-4 py-2 font-mono text-slate-600">
                    <div>{ex.id}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{format(ex.date, "MMM dd HH:mm")}</div>
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                       {ex.patientName} <span className="text-[10px] font-mono text-slate-400">({ex.ipp})</span>
                       {ex.critical && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{ex.prescriber}</td>
                  <td className="px-4 py-2 text-slate-900 font-medium">{ex.type}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                       "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                       ex.priority === 'STAT' ? "bg-red-100 text-red-700" :
                       ex.priority === 'Urgent' ? "bg-yellow-100 text-yellow-700" :
                       "bg-slate-100 text-slate-600"
                    )}>
                      {ex.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn(
                       "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                       ex.status === 'Pending Sample' ? "bg-slate-100 text-slate-700" :
                       ex.status === 'In Analysis' ? "bg-blue-100 text-blue-700" :
                       ex.status === 'Awaiting Validation' ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
                       "bg-green-100 text-green-700"
                    )}>
                      {ex.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button 
                       className={cn(
                          "font-semibold px-3 py-1 rounded text-[11px]",
                          ex.status === 'In Analysis' ? "bg-blue-600 text-white hover:bg-blue-700" :
                          ex.status === 'Awaiting Validation' ? "bg-yellow-500 text-white hover:bg-yellow-600" :
                          "text-blue-600 hover:bg-blue-50"
                       )}
                       onClick={(e) => { e.stopPropagation(); setSelectedExam(ex); }}
                    >
                      {ex.status === 'Pending Sample' ? 'Collect' : 
                       ex.status === 'In Analysis' ? 'Enter Results' : 
                       ex.status === 'Awaiting Validation' ? 'Validate' : tc('view')}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredExams.length === 0 && (
                <tr>
                   <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">{tc('no_data')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Action Sheet */}
      <Sheet open={!!selectedExam} onOpenChange={(open) => !open && setSelectedExam(null)}>
        {selectedExam && (
           <SheetContent className="sm:max-w-2xl w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
             <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
               <div className="flex items-start justify-between">
                 <div>
                   <SheetTitle className="text-lg flex items-center gap-2">
                     {selectedExam.type}
                     <span className={cn(
                         "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                         selectedExam.status === 'Pending Sample' ? "bg-slate-100 text-slate-700" :
                         selectedExam.status === 'In Analysis' ? "bg-blue-100 text-blue-700" :
                         selectedExam.status === 'Awaiting Validation' ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
                         "bg-green-100 text-green-700"
                      )}>
                        {selectedExam.status}
                      </span>
                      {selectedExam.priority !== "Routine" && (
                         <span className={cn(
                           "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                           selectedExam.priority === 'STAT' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                         )}>
                            {selectedExam.priority}
                         </span>
                      )}
                   </SheetTitle>
                   <SheetDescription className="text-xs mt-1">
                     <span className="font-mono">ID: {selectedExam.id}</span> &bull; Prescribed by {selectedExam.prescriber} on {format(selectedExam.date, "PPP 'at' p")}
                   </SheetDescription>
                 </div>
                 {selectedExam.critical && (
                   <div className="bg-red-50 text-red-700 px-3 py-1.5 rounded border border-red-200 flex items-center gap-2 text-xs font-bold shrink-0">
                     <AlertTriangle className="h-4 w-4" /> CRITICAL RESULT
                   </div>
                 )}
               </div>
             </SheetHeader>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                       {selectedExam.patientName.charAt(0)}
                     </div>
                     <div>
                       <div className="text-sm font-bold text-slate-900">{selectedExam.patientName}</div>
                       <div className="text-[10px] font-mono text-slate-500">IPP: {selectedExam.ipp}</div>
                     </div>
                   </div>
                   <Button variant="outline" size="sm" className="text-xs h-7">View Context</Button>
                </div>
                
                {selectedExam.status === 'Pending Sample' && (
                  <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
                     <FlaskConical className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                     <h3 className="text-sm font-bold text-slate-800">Awaiting Sample Collection</h3>
                     <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Please confirm the sample has been collected and appropriately labeled before analysis begins.</p>
                     <Button className="mt-4 text-xs h-8 bg-blue-600" onClick={() => setSelectedExam({...selectedExam, status: 'In Analysis'})}>
                       Mark as Collected
                     </Button>
                  </div>
                )}

                {(selectedExam.status === 'In Analysis' || selectedExam.status === 'Awaiting Validation' || selectedExam.status === 'Completed') && (
                  <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                     <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Test Parameters</div>
                        {selectedExam.status === 'In Analysis' && (
                           <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600" onClick={() => setIsResultEntryOpen(true)}>
                             <Edit3 className="h-3 w-3 mr-1" /> Enter Results
                           </Button>
                        )}
                     </div>
                     <table className="w-full text-left text-xs">
                       <thead className="bg-slate-50/50 text-[10px] text-slate-500">
                         <tr>
                           <th className="px-4 py-2 font-semibold">Marker</th>
                           <th className="px-4 py-2 font-semibold">Value</th>
                           <th className="px-4 py-2 font-semibold">Unit</th>
                           <th className="px-4 py-2 font-semibold">Ref. Range</th>
                           <th className="px-4 py-2 font-semibold">Flag</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {selectedExam.id === "EXM-1003" ? (
                            <tr>
                              <td className="px-4 py-3 font-medium text-slate-900">Troponin I</td>
                              <td className="px-4 py-3 font-bold text-red-600 text-sm">2.45</td>
                              <td className="px-4 py-3 text-slate-500">ng/mL</td>
                              <td className="px-4 py-3 text-slate-500">{"<"} 0.04</td>
                              <td className="px-4 py-3">
                                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase text-[9px] tracking-wider">High</span>
                              </td>
                            </tr>
                          ) : selectedExam.status === 'In Analysis' ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">No results logged yet.</td>
                            </tr>
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-slate-400">Results are within normal range.</td>
                            </tr>
                          )}
                       </tbody>
                     </table>
                  </div>
                )}
             </div>
             
             <SheetFooter className="p-4 border-t border-slate-200 bg-slate-100 shrink-0 justify-between items-center flex-row">
                 <Button variant="ghost" size="sm" className="text-xs text-slate-600 hover:text-slate-900">
                    <Printer className="mr-2 h-4 w-4" /> Print Detail
                 </Button>
                 
                 <div className="flex gap-2">
                    {selectedExam.status === 'Awaiting Validation' && (
                       <>
                         <Button variant="outline" className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                           <X className="mr-2 h-3.5 w-3.5" /> Reject Results
                         </Button>
                         <Button className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => setSelectedExam({...selectedExam, status: 'Completed'})}>
                           <FileSignature className="mr-2 h-3.5 w-3.5" /> Validate & Publish
                         </Button>
                       </>
                    )}
                    {selectedExam.status === 'Completed' && (
                       <span className="text-xs font-bold uppercase tracking-wider text-green-700 flex items-center px-4 py-1.5 bg-green-100 rounded border border-green-200">
                          <Check className="mr-2 h-4 w-4" /> Clinically Validated
                       </span>
                    )}
                 </div>
             </SheetFooter>
           </SheetContent>
        )}
      </Sheet>

      {/* New Exam Request Sheet */}
      <Sheet open={isNewExamOpen} onOpenChange={setIsNewExamOpen}>
        <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
             <SheetTitle className="text-lg">Prescribe Laboratory Exam</SheetTitle>
             <SheetDescription className="text-xs">Create a new lab request.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Patient Search</label>
                <PatientSearchAutocomplete className="h-9 text-xs" />
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Panel / Assay Type</label>
                <select className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400">
                  <option>Complete Blood Count (CBC)</option>
                  <option>Comprehensive Metabolic Panel (CMP)</option>
                  <option>Lipid Panel</option>
                  <option>Troponin I</option>
                  <option>Urinalysis</option>
                </select>
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Priority</label>
                <div className="flex gap-2">
                   <label className="flex-1 border rounded p-2 text-center cursor-pointer hover:bg-slate-50 flex flex-col items-center gap-1 bg-white border-slate-200 shadow-sm">
                      <input type="radio" name="priority" className="hidden" />
                      <span className="text-[11px] font-bold text-slate-700 uppercase">Routine</span>
                   </label>
                   <label className="flex-1 border rounded p-2 text-center cursor-pointer hover:bg-orange-50 bg-white flex flex-col items-center gap-1 border-slate-200 shadow-sm">
                      <input type="radio" name="priority" className="hidden" />
                      <span className="text-[11px] font-bold text-orange-600 uppercase">Urgent</span>
                   </label>
                   <label className="flex-1 border rounded p-2 text-center cursor-pointer hover:bg-red-50 bg-white flex flex-col items-center gap-1 border-slate-200 shadow-sm">
                      <input type="radio" name="priority" className="hidden" />
                      <span className="text-[11px] font-bold text-red-600 uppercase">STAT</span>
                   </label>
                </div>
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Clinical Notes</label>
                <textarea className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 min-h-[80px]" placeholder="Reason for test..."></textarea>
             </div>
          </div>
          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
             <Button variant="outline" size="sm" onClick={() => setIsNewExamOpen(false)} className="text-xs h-8">Cancel</Button>
             <Button size="sm" onClick={() => setIsNewExamOpen(false)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">Prescribe</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Result Entry Modal overlay simulation */}
      <Dialog open={isResultEntryOpen} onOpenChange={setIsResultEntryOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden flex flex-col gap-0 border-0 outline-none">
           <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-slate-50 space-y-0">
              <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                 <ClipboardList className="h-4 w-4 text-blue-600" /> Enter Results
              </DialogTitle>
              {/* <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsResultEntryOpen(false)}>
                <X className="h-4 w-4" />
              </Button> */}
           </DialogHeader>
           <div className="p-4 overflow-y-auto space-y-4 max-h-[80vh]">
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Upload Analyzer Raw Data</label>
                 <div className="border border-dashed border-slate-300 rounded-md p-4 text-center cursor-pointer hover:bg-slate-50">
                    <p className="text-xs text-slate-500">Drag & drop raw file or <span className="text-blue-600">browse</span></p>
                 </div>
              </div>
              <div className="relative flex items-center">
                 <div className="flex-grow border-t border-slate-200"></div>
                 <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] uppercase font-bold tracking-widest">OR MANUAL ENTRY</span>
                 <div className="flex-grow border-t border-slate-200"></div>
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Result Value</label>
                 <div className="flex gap-2">
                    <Input type="number" step="0.01" placeholder="e.g. 2.45" className="h-8 text-xs font-mono" />
                    <select className="flex h-8 w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 text-slate-500">
                      <option>ng/mL</option>
                      <option>mg/dL</option>
                      <option>mmol/L</option>
                    </select>
                 </div>
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Clinical Flag</label>
                 <select className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400">
                   <option value="normal">Normal</option>
                   <option value="high">High</option>
                   <option value="low">Low</option>
                   <option value="critical">Critical</option>
                 </select>
              </div>
           </div>
           <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsResultEntryOpen(false)} className="text-xs h-8">Cancel</Button>
              <Button size="sm" onClick={() => {
                 setIsResultEntryOpen(false);
                 setSelectedExam({...selectedExam, status: 'Awaiting Validation', critical: true});
              }} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">Save Results</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
