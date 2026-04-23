"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek } from "date-fns";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Building2, CalendarDays, Users, Search, Plus, Filter, AlertCircle, CalendarClock, UserMinus, FileDigit, Clock
} from "lucide-react";

// Stub Data for departments
const departments = [
  { id: "DEP-001", name: "Emergency Room", head: "Dr. L. Chen", staffCount: 45, type: "Clinical" },
  { id: "DEP-002", name: "Intensive Care Unit (ICU)", head: "Dr. A. Thorne", staffCount: 32, type: "Clinical" },
  { id: "DEP-003", name: "Surgery", head: "Dr. M. Davis", staffCount: 28, type: "Clinical" },
  { id: "DEP-004", name: "Laboratory", head: "Dr. S. Smith", staffCount: 15, type: "Diagnostic" },
  { id: "DEP-005", name: "Administration", head: "J. Doe", staffCount: 12, type: "Administrative" },
];

// Stub Data for schedules
const mockStaff = [
  { id: "STF-001", name: "Dr. Sarah Jenkins", role: "Attending", departmentId: "DEP-001" },
  { id: "STF-002", name: "Nurse Mark Wood", role: "Charge Nurse", departmentId: "DEP-001" },
  { id: "STF-003", name: "Dr. Emily Rostova", role: "Resident", departmentId: "DEP-001" },
  { id: "STF-004", name: "Tech David Ross", role: "ER Tech", departmentId: "DEP-001" },
];

export default function PlanningPage() {
  const t = useTranslations('planning');
  const tc = useTranslations('common');
  const hasModule = useAppStore((state) => state.hasModule);
  const [activeTab, setActiveTab] = useState<"roster" | "departments">("roster");
  const [selectedDept, setSelectedDept] = useState("DEP-001");
  const [isNewShiftOpen, setIsNewShiftOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isNewDeptOpen, setIsNewDeptOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  if (!hasModule("MODULE_PLANNING")) {
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

  // Generate current week dates
  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  // Determine stub schedule colors based on time
  const getShiftStyles = (shiftType: string) => {
     if (shiftType === 'Morning (07:00-15:00)') return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
     if (shiftType === 'Evening (15:00-23:00)') return "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100";
     if (shiftType === 'Night (23:00-07:00)') return "bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700";
     if (shiftType === 'Off') return "bg-slate-50 text-slate-400 border-dashed border-slate-200";
     if (shiftType === 'Sick Leave') return "bg-red-50 text-red-700 border-red-200 bg-stripes bg-stripes-red";
     return "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
  };

  const getMockShift = (staffId: string, dayIndex: number) => {
     // Predictable stub data generation
     if (staffId === "STF-001" && dayIndex === 4) return 'Sick Leave';
     if (staffId === "STF-003" && (dayIndex === 5 || dayIndex === 6)) return 'Off';
     if (dayIndex % 3 === 0) return 'Morning (07:00-15:00)';
     if (dayIndex % 3 === 1) return 'Evening (15:00-23:00)';
     return 'Night (23:00-07:00)';
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-md">
          <button 
            className={cn("px-4 py-1.5 rounded text-xs font-semibold flex items-center transition-colors", activeTab === "roster" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800")}
            onClick={() => setActiveTab("roster")}
          >
            <CalendarDays className="h-3.5 w-3.5 mr-2" /> {t('shift_rosters')}
          </button>
          <button 
            className={cn("px-4 py-1.5 rounded text-xs font-semibold flex items-center transition-colors", activeTab === "departments" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800")}
            onClick={() => setActiveTab("departments")}
          >
            <Building2 className="h-3.5 w-3.5 mr-2" /> {t('departments')}
          </button>
        </div>
      </div>

      {activeTab === "roster" ? (
        <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('department')}:</label>
                 <select 
                   className="h-8 text-xs bg-white border border-slate-200 rounded px-3 py-1 font-semibold text-slate-700 focus:outline-none focus:border-blue-400"
                   value={selectedDept}
                   onChange={(e) => setSelectedDept(e.target.value)}
                 >
                   {departments.map(d => (
                     <option key={d.id} value={d.id}>{d.name}</option>
                   ))}
                 </select>
               </div>
               <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="h-8 px-2 text-slate-500"><CalendarClock className="h-4 w-4" /></Button>
                 <span className="text-sm font-bold text-slate-700">Week of {format(startDate, "MMM dd, yyyy")}</span>
                 <Button variant="outline" size="sm" className="h-8 px-2 text-slate-500"><CalendarClock className="h-4 w-4" /></Button>
               </div>
             </div>
             <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700" onClick={() => setIsAbsenceModalOpen(true)}>
                  <UserMinus className="h-3.5 w-3.5 mr-2" /> {t('declare_absence')}
                </Button>
                <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => setIsNewShiftOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-2" /> {t('assign_shift')}
                </Button>
             </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] text-slate-500 uppercase font-bold sticky top-0 z-10 shadow-sm">
                  <th className="px-4 py-3 border-b border-r border-slate-200 w-48 bg-slate-100">{t('staff_member')}</th>
                  {weekDays.map((date, i) => (
                    <th key={i} className="px-2 py-3 border-b border-r border-slate-200 text-center min-w-[120px] bg-slate-100">
                      <div className="text-slate-400">{format(date, "EEE")}</div>
                      <div className={cn("text-sm", format(date, "P") === format(new Date(), "P") ? "text-blue-600 font-black" : "text-slate-800")}>
                         {format(date, "dd")}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {mockStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/50 group">
                    <td className="px-4 py-3 border-r border-slate-100 bg-white">
                      <div className="font-bold text-slate-900">{staff.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{staff.role}</div>
                    </td>
                    {weekDays.map((_, dayIndex) => {
                       const shift = getMockShift(staff.id, dayIndex);
                       const isOff = shift === 'Off' || shift === 'Sick Leave';
                       return (
                         <td key={dayIndex} className="p-1.5 border-r border-slate-100 align-top">
                           <div 
                             className={cn(
                               "rounded border p-2 text-[10px] font-bold h-full min-h-[48px] flex flex-col justify-center items-center text-center cursor-pointer transition-colors",
                               getShiftStyles(shift)
                             )}
                             onClick={() => {
                                setSelectedStaff(staff);
                                setIsNewShiftOpen(true);
                             }}
                           >
                             {shift === 'Sick Leave' ? (
                                <span className="flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> Sick Leave</span>
                             ) : shift === 'Off' ? (
                                '-- OFF --'
                             ) : (
                                <>
                                  <span className="mb-0.5">{shift.split(' ')[0]}</span>
                                  <span className="font-mono opacity-70">{shift.split(' ')[1].replace(/[()]/g, '')}</span>
                                </>
                             )}
                           </div>
                         </td>
                       );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="relative w-96 flex-1">
                 <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                 <Input
                   type="search"
                   placeholder={tc('search')}
                   className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
                 />
               </div>
               <Button size="sm" className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800 ml-4" onClick={() => setIsNewDeptOpen(true)}>
                 <Plus className="h-3.5 w-3.5 mr-2" /> Add Department
               </Button>
           </div>
           <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-3 gap-4">
                 {departments.map(dept => (
                    <div key={dept.id} className="border border-slate-200 rounded p-4 shadow-sm hover:shadow hover:border-blue-300 transition-all cursor-pointer">
                       <div className="flex justify-between items-start mb-3">
                          <div>
                             <h3 className="font-bold text-slate-800 text-sm">{dept.name}</h3>
                             <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {dept.id}</p>
                          </div>
                          <span className={cn(
                             "px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider",
                             dept.type === 'Clinical' ? "bg-blue-50 text-blue-700 border border-blue-100" :
                             dept.type === 'Diagnostic' ? "bg-purple-50 text-purple-700 border border-purple-100" :
                             "bg-slate-100 text-slate-700 border border-slate-200"
                          )}>
                             {dept.type}
                          </span>
                       </div>
                       <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                             {dept.head.charAt(4)}
                          </div>
                          <div className="text-xs text-slate-600"><span className="text-slate-400">{tc('name')} Head:</span> {dept.head}</div>
                       </div>
                       <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                          <div className="text-xs font-semibold text-slate-700 flex items-center">
                             <Users className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> {dept.staffCount} Staff
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600 p-0 hover:bg-transparent hover:underline" onClick={() => {
                             setSelectedDept(dept.id);
                             setActiveTab("roster");
                          }}>
                             View Roster &rarr;
                          </Button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Assign Shift Modal overlay */}
      <Dialog open={isNewShiftOpen} onOpenChange={(val) => { setIsNewShiftOpen(val); if(!val) setSelectedStaff(null); }}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden flex flex-col gap-0 border-0 outline-none">
           <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-slate-50 space-y-0">
              <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                 <Clock className="h-4 w-4 text-blue-600" /> {t('assign_shift')}
              </DialogTitle>
           </DialogHeader>
           <div className="p-4 overflow-y-auto space-y-4 max-h-[80vh]">
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t('staff_member')}</label>
                 <select className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400" defaultValue={selectedStaff?.name || ""}>
                   <option value="" disabled>Select staff...</option>
                   {mockStaff.map(s => <option key={s.id}>{s.name} ({s.role})</option>)}
                 </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{tc('date')}</label>
                     <Input type="date" className="h-9 text-xs" />
                 </div>
                 <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t('shift_type')}</label>
                     <select className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400">
                       <option>Morning (07:00-15:00)</option>
                       <option>Evening (15:00-23:00)</option>
                       <option>Night (23:00-07:00)</option>
                       <option>On Call (24h)</option>
                     </select>
                 </div>
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Notes / Station assigned</label>
                 <Input placeholder="e.g. Triage Station 1" className="h-9 text-xs" />
              </div>
           </div>
           <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setIsNewShiftOpen(false); setSelectedStaff(null); }} className="text-xs h-8">{tc('cancel')}</Button>
              <Button size="sm" onClick={() => { setIsNewShiftOpen(false); setSelectedStaff(null); }} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">{t('assign_shift')}</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Declare Absence Modal overlay */}
      <Dialog open={isAbsenceModalOpen} onOpenChange={setIsAbsenceModalOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden flex flex-col gap-0 border-t-4 border-t-orange-500 outline-none">
           <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-orange-50/50 space-y-0">
              <DialogTitle className="text-sm font-bold text-orange-800 flex items-center gap-2">
                 <UserMinus className="h-4 w-4 text-orange-600" /> Declare Absence
              </DialogTitle>
           </DialogHeader>
           <div className="p-4 overflow-y-auto space-y-4 max-h-[80vh]">
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Staff Member</label>
                 <select className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400" defaultValue="">
                   <option value="" disabled>Select staff...</option>
                   {mockStaff.map(s => <option key={s.id}>{s.name}</option>)}
                 </select>
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Type of Absence</label>
                 <select className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400">
                   <option>Sick Leave</option>
                   <option>Vacation / PTO</option>
                   <option>Maternity/Paternity</option>
                   <option>Unjustified</option>
                 </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">From</label>
                     <Input type="date" className="h-9 text-xs" />
                 </div>
                 <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">To</label>
                     <Input type="date" className="h-9 text-xs" />
                 </div>
              </div>
              <div className="p-3 bg-red-50 border border-red-100 rounded text-xs text-red-800 flex items-start">
                 <AlertCircle className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                 <span>Declaring an absence will immediately clear any shifts assigned within this date range.</span>
              </div>
           </div>
           <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsAbsenceModalOpen(false)} className="text-xs h-8">Cancel</Button>
              <Button size="sm" onClick={() => setIsAbsenceModalOpen(false)} className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8">Confirm Absence</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* New Dept Modal */}
      <Dialog open={isNewDeptOpen} onOpenChange={setIsNewDeptOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden flex flex-col gap-0 border-0 outline-none">
           <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-slate-50 space-y-0">
              <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                 <Building2 className="h-4 w-4 text-slate-600" /> Create Department
              </DialogTitle>
           </DialogHeader>
           <div className="p-4 overflow-y-auto space-y-4 max-h-[80vh]">
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Department Name</label>
                 <Input placeholder="e.g. Pediatrics" className="h-9 text-xs" />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Department Head (Director)</label>
                 <Input placeholder="Type to search staff..." className="h-9 text-xs" />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Classification</label>
                 <select className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400">
                   <option>Clinical</option>
                   <option>Diagnostic</option>
                   <option>Administrative</option>
                   <option>Logistics / Support</option>
                 </select>
              </div>
           </div>
           <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsNewDeptOpen(false)} className="text-xs h-8">Cancel</Button>
              <Button size="sm" onClick={() => setIsNewDeptOpen(false)} className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8">Create Structure</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
