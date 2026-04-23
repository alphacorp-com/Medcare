"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { 
  Search, ScanLine, AlertTriangle, FileImage, 
  UploadCloud, FileCheck, CheckCircle2, FlaskConical, Filter, Radio,
  Plus, Printer, Download, Mail
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

type RadiologyExam = {
  id: string;
  patientName: string;
  ipp: string;
  exam: string;
  status: string;
  date: string;
  urgency: string;
  url: string | null;
};

export default function RadiologyPage() {
  const hasModule = useAppStore((state) => state.hasModule);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [exams, setExams] = useState<RadiologyExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewReqOpen, setIsNewReqOpen] = useState(false);

  useEffect(() => {
     if (!hasModule("MODULE_RADIOLOGY")) return;
     fetchExams();
  }, [hasModule]);

  const fetchExams = async () => {
    try {
       const res = await fetch('/api/v1/radiology');
       const data = await res.json();
       setExams(data);
    } catch (err) {
       console.error("Failed to load radiology data");
    } finally {
       setIsLoading(false);
    }
  };

  const handleReqSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = {
      patientName: formData.get("patientName"),
      ipp: formData.get("ipp"),
      exam: formData.get("exam"),
      urgency: formData.get("urgency")
    };
    try {
      await fetch('/api/v1/radiology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      fetchExams();
      setIsNewReqOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = () => {
     let csvContent = [
      ["Organization: MedCore HMS", "123 Health Ave", "+1 234 567 8900", ""],
      [""],
      ["Req ID", "Patient Name", "IPP", "Exam Type", "Urgency", "Status", "Date"]
     ];
     exams.forEach(e => {
       csvContent.push([e.id, `"${e.patientName}"`, e.ipp, `"${e.exam}"`, e.urgency, e.status, e.date]);
     });
     const blob = new Blob([csvContent.map(e => e.join(",")).join("\n")], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = `radiology_export_${format(new Date(), 'yyyyMMdd')}.csv`;
     link.click();
  };

  const handlePrint = () => {
      window.print();
  };

  if (!hasModule("MODULE_RADIOLOGY")) {
    return (
      <div className="flex h-full items-center justify-center">
         <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Module Access Restricted</h2>
            <p className="mt-2 text-sm text-slate-500">The Radiology Unit module is not active for your role, or has been disabled across the environment.</p>
            <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
               Please contact your System Administrator to request access privileges.
            </p>
         </div>
      </div>
    );
  }

  const filteredExams = exams.filter(e => {
    if (filter !== "All" && e.status !== filter) return false;
    if (search && !e.patientName.toLowerCase().includes(search.toLowerCase()) && !e.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Radiology Integration Endpoints</h1>
          <p className="text-xs text-slate-500 mt-1">Track pending imaging requests & access PACs reporting portals.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-2" /> Print</Button>
           <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportCSV}><Download className="h-3.5 w-3.5 mr-2" /> Export</Button>
           <a href={`mailto:?subject=Radiology Schedule&body=Please find the attached radiology logs.%0A%0AOrganization: MedCore HMS%0A123 Health Ave, Medical City`} className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
             <Mail className="h-3.5 w-3.5 mr-2" /> Email
           </a>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={() => setIsNewReqOpen(true)}>
             <Plus className="mr-2 h-3.5 w-3.5" /> New Request
           </Button>

           <Sheet open={isNewReqOpen} onOpenChange={setIsNewReqOpen}>
             <SheetContent className="sm:max-w-xl overflow-y-auto">
               <SheetHeader>
                 <SheetTitle>New Radiology Request</SheetTitle>
               </SheetHeader>
               <form onSubmit={handleReqSubmit} className="space-y-6 mt-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Patient Name</Label>
                     <Input name="patientName" required placeholder="John Doe" />
                   </div>
                   <div className="space-y-2">
                     <Label>IPP (Identifier)</Label>
                     <Input name="ipp" required placeholder="100000123" />
                   </div>
                   <div className="space-y-2 col-span-2">
                     <Label>Exam Type</Label>
                     <Input name="exam" required placeholder="Scanner Thoracique" />
                   </div>
                   <div className="space-y-2 col-span-2">
                     <Label>Urgency</Label>
                     <select name="urgency" className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500">
                       <option value="Routine">Routine</option>
                       <option value="Urgent">Urgent</option>
                       <option value="STAT">STAT (Immediate)</option>
                     </select>
                   </div>
                 </div>
                 <div className="flex justify-end gap-3 pt-6 border-t">
                   <Button type="button" variant="outline" onClick={() => setIsNewReqOpen(false)}>Cancel</Button>
                   <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Submit Request</Button>
                 </div>
               </form>
             </SheetContent>
           </Sheet>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Result Available")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Reports Available</div>
            <div className="text-3xl font-bold text-slate-900">{exams.filter(e => e.status === 'Result Available').length}</div>
          </div>
          <FileImage className="h-8 w-8 text-slate-200" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Awaiting Exam")}>
          <div>
            <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">Awaiting Exam</div>
            <div className="text-3xl font-bold text-orange-600">{exams.filter(e => e.status === 'Awaiting Exam').length}</div>
          </div>
          <Radio className="h-8 w-8 text-orange-200" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
           <div className="relative w-96 flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder="Search Radiology ID, patient name..."
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
          {filteredExams.length === 0 ? (
             <div className="flex items-center justify-center h-full text-slate-400 text-sm flex-col">
               <ScanLine className="h-8 w-8 mb-2 opacity-50" />
               No records found
             </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  <th className="p-4 font-semibold w-32">Req ID</th>
                  <th className="p-4 font-semibold w-48">Patient</th>
                  <th className="p-4 font-semibold">Exam Type</th>
                  <th className="p-4 font-semibold w-32">Status</th>
                  <th className="p-4 font-semibold text-right w-64">Reporting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredExams.map((exam) => (
                  <TableRow key={exam.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="p-4">
                      <div className="font-mono text-xs font-medium text-slate-700">{exam.id}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{format(new Date(exam.date), "MMM d, HH:mm")}</div>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="text-sm font-semibold text-slate-900">{exam.patientName}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">IPP: {exam.ipp}</div>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="text-sm text-slate-800">{exam.exam}</div>
                      {exam.urgency === 'STAT' && (
                        <span className="inline-flex items-center text-[10px] mt-1 text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-widest font-bold">
                          Urgent
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="p-4">
                       <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        exam.status === "Awaiting Exam" ? "bg-orange-100 text-orange-700" :
                        "bg-green-100 text-green-700"
                      )}>
                        {exam.status}
                      </span>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                       <div className="flex justify-end gap-2">
                         {exam.status === 'Result Available' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
                              <FileCheck className="w-3.5 h-3.5 mr-1.5" /> View PACs Report
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
