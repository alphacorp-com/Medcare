"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { 
  Search, Filter, Scissors, Syringe, Clock, CheckCircle2, PlayCircle, ClipboardCheck, Plus, AlertCircle, Printer, Download, Mail
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Surgery = {
  id: string;
  patientName: string;
  ipp: string;
  surgeon: string;
  type: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled";
  date: string;
  checklistCompleted: boolean;
};

export default function SurgeryPage() {
  const hasModule = useAppStore((state) => state.hasModule);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  useEffect(() => {
    if (!hasModule("MODULE_SURGERY")) return;
    fetchSurgeries();
  }, [hasModule]);

  const fetchSurgeries = async () => {
    try {
      const res = await fetch('/api/v1/surgeries');
      const data = await res.json();
      setSurgeries(data);
    } catch (err) {
      console.error("Failed to fetch surgeries", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = {
      patientName: formData.get("patientName"),
      ipp: formData.get("ipp"),
      surgeon: formData.get("surgeon"),
      type: formData.get("type"),
      date: formData.get("date")
    };
    try {
      await fetch('/api/v1/surgeries', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      fetchSurgeries();
      setIsScheduleOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, action: 'start' | 'complete' | 'checklist') => {
    try {
      await fetch(`/api/v1/surgeries/${id}/${action}`, { method: 'PATCH' });
      fetchSurgeries();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = () => {
     let csvContent = [
      ["Organization: MedCore HMS", "123 Health Ave", "+1 234 567 8900", ""],
      [""],
      ["ID", "Patient Name", "IPP", "Surgeon", "Type", "Status", "Date"]
     ];
     surgeries.forEach(s => {
       csvContent.push([s.id, `"${s.patientName}"`, s.ipp, `"${s.surgeon}"`, `"${s.type}"`, s.status, s.date]);
     });
     const blob = new Blob([csvContent.map(e => e.join(",")).join("\n")], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = `surgery_schedule_export_${format(new Date(), 'yyyyMMdd')}.csv`;
     link.click();
  };

  const handlePrint = () => {
      window.print();
  };

  if (!hasModule("MODULE_SURGERY")) {
    return (
      <div className="flex h-full items-center justify-center">
         <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Module Access Restricted</h2>
            <p className="mt-2 text-sm text-slate-500">The Surgical Block module is not active for your role, or has been disabled across the environment.</p>
            <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
               Please contact your System Administrator to request access privileges.
            </p>
         </div>
      </div>
    );
  }

  const filteredSurgeries = surgeries.filter(s => {
    if (filter !== "All" && s.status !== filter) return false;
    if (search && !s.patientName.toLowerCase().includes(search.toLowerCase()) && !s.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Surgical Block Planning</h1>
          <p className="text-xs text-slate-500 mt-1">Manage operating room schedules, WHO checklists, and surgical reports.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-2" /> Print</Button>
           <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportCSV}><Download className="h-3.5 w-3.5 mr-2" /> Export</Button>
           <a href={`mailto:?subject=Surgical Block Schedule&body=Please find the attached surgical schedule.%0A%0AOrganization: MedCore HMS%0A123 Health Ave, Medical City`} className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
             <Mail className="h-3.5 w-3.5 mr-2" /> Email
           </a>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={() => setIsScheduleOpen(true)}>
             <Plus className="mr-2 h-3.5 w-3.5" /> Schedule Intervention
           </Button>

           <Sheet open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
             <SheetContent className="sm:max-w-xl overflow-y-auto">
               <SheetHeader>
                 <SheetTitle>Schedule Surgical Intervention</SheetTitle>
               </SheetHeader>
               <form onSubmit={handleScheduleSubmit} className="space-y-6 mt-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Patient Name</Label>
                     <Input name="patientName" required placeholder="John Doe" />
                   </div>
                   <div className="space-y-2">
                     <Label>IPP (Identifier)</Label>
                     <Input name="ipp" required placeholder="100000123" />
                   </div>
                   <div className="space-y-2">
                     <Label>Surgeon</Label>
                     <Input name="surgeon" required placeholder="Dr. XYZ" />
                   </div>
                   <div className="space-y-2">
                     <Label>Procedure Type</Label>
                     <Input name="type" required placeholder="Appendectomy" />
                   </div>
                   <div className="space-y-2 col-span-2">
                     <Label>Scheduled Date & Time</Label>
                     <Input name="date" type="datetime-local" required />
                   </div>
                 </div>
                 <div className="flex justify-end gap-3 pt-6 border-t">
                   <Button type="button" variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                   <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Schedule</Button>
                 </div>
               </form>
             </SheetContent>
           </Sheet>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Scheduled")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Scheduled</div>
            <div className="text-3xl font-bold text-slate-900">{surgeries.filter(e => e.status === 'Scheduled').length}</div>
          </div>
          <Clock className="h-8 w-8 text-slate-200" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("In Progress")}>
          <div>
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">In OR (In Progress)</div>
            <div className="text-3xl font-bold text-blue-600">{surgeries.filter(e => e.status === 'In Progress').length}</div>
          </div>
          <Syringe className="h-8 w-8 text-blue-100" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Completed")}>
          <div>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Completed</div>
            <div className="text-3xl font-bold text-green-600">{surgeries.filter(e => e.status === 'Completed').length}</div>
          </div>
          <CheckCircle2 className="h-8 w-8 text-green-100" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
           <div className="relative w-96 flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder="Search intervention ID, patient name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
              />
            </div>
            <div className="flex bg-slate-200/50 p-1 rounded-md ml-4">
              <button className={cn("px-4 py-1 rounded text-xs font-semibold transition-colors", filter === "All" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800")} onClick={() => setFilter("All")}>All</button>
            </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {isLoading ? (
             <div className="flex items-center justify-center h-full text-slate-400">Loading schedule...</div>
          ) : filteredSurgeries.length === 0 ? (
             <div className="flex items-center justify-center h-full text-slate-400 text-sm flex-col">
               <Scissors className="h-8 w-8 mb-2 opacity-50" />
               No interventions match criteria
             </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  <th className="p-4 font-semibold w-32">Intervention ID</th>
                  <th className="p-4 font-semibold w-48">Patient</th>
                  <th className="p-4 font-semibold">Procedure</th>
                  <th className="p-4 font-semibold w-48">Surgeon</th>
                  <th className="p-4 font-semibold w-32">Status</th>
                  <th className="p-4 font-semibold text-right w-64">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredSurgeries.map((surg) => (
                  <TableRow key={surg.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="p-4">
                      <div className="font-mono text-xs font-medium text-slate-700">{surg.id}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{format(new Date(surg.date), "MMM d, HH:mm")}</div>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="text-sm font-semibold text-slate-900">{surg.patientName}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">IPP: {surg.ipp}</div>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="text-sm text-slate-800">{surg.type}</div>
                      {!surg.checklistCompleted && surg.status === 'Scheduled' && (
                        <span className="inline-flex items-center text-[10px] mt-1 text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                          <AlertCircle className="w-3 h-3 mr-1" /> WHO Checklist Missing
                        </span>
                      )}
                      {surg.checklistCompleted && (
                        <span className="inline-flex items-center text-[10px] mt-1 text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Checklist Complete
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="p-4 text-sm text-slate-600 font-medium">
                      {surg.surgeon}
                    </TableCell>
                    <TableCell className="p-4">
                       <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        surg.status === "Scheduled" ? "bg-slate-100 text-slate-600" :
                        surg.status === "In Progress" ? "bg-blue-100 text-blue-700 blink-pulse" :
                        surg.status === "Completed" ? "bg-green-100 text-green-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {surg.status}
                      </span>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                       <div className="flex justify-end gap-2">
                         {surg.status === 'Scheduled' && (
                           <>
                             {!surg.checklistCompleted ? (
                                <Button variant="outline" size="sm" className="h-7 text-xs bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" onClick={() => updateStatus(surg.id, 'checklist')}>
                                  <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Validate WHO
                                </Button>
                             ) : (
                                <Button size="sm" className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700" onClick={() => updateStatus(surg.id, 'start')}>
                                  <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Start Surgery
                                </Button>
                             )}
                           </>
                         )}
                         {surg.status === 'In Progress' && (
                            <Button size="sm" className="h-7 text-xs bg-green-600 text-white hover:bg-green-700" onClick={() => updateStatus(surg.id, 'complete')}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Complete & Sign
                            </Button>
                         )}
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
