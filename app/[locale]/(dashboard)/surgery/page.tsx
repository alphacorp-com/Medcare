"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import {
  Search, Scissors, Syringe, Clock, CheckCircle2, PlayCircle, ClipboardCheck, Plus,
  AlertCircle, Printer, Download, Mail, XCircle, CalendarClock,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { isPhaseComplete } from "@/lib/surgery/checklist";
import { ScheduleSurgerySheet } from "./_components/ScheduleSurgerySheet";
import { ChecklistSheet } from "./_components/ChecklistSheet";
import { CompleteSurgerySheet } from "./_components/CompleteSurgerySheet";
import { CancelPostponeDialog } from "./_components/CancelPostponeDialog";
import { RescheduleDialog } from "./_components/RescheduleDialog";
import { Doctor, Surgery, SurgicalStatus } from "./types";

const STATUS_FILTERS: (SurgicalStatus | "All")[] = ["All", "scheduled", "in_progress", "completed", "cancelled", "postponed"];

export default function SurgeryPage() {
  const t = useTranslations('surgery');
  const tc = useTranslations('common');
  const hasModule = useAppStore((state) => state.hasModule);

  const [filter, setFilter] = useState<SurgicalStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [checklistSurgery, setChecklistSurgery] = useState<Surgery | null>(null);
  const [completeSurgery, setCompleteSurgery] = useState<Surgery | null>(null);
  const [cancelPostpone, setCancelPostpone] = useState<{ surgery: Surgery; action: "cancel" | "postpone" } | null>(null);
  const [rescheduleSurgery, setRescheduleSurgery] = useState<Surgery | null>(null);

  const doctorsById = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  const fetchSurgeries = async (): Promise<Surgery[]> => {
    try {
      const res = await fetch('/api/v1/surgeries');
      const data = await res.json();
      const list: Surgery[] = Array.isArray(data) ? data : [];
      setSurgeries(list);
      return list;
    } catch (err) {
      console.error("Failed to fetch surgeries", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/v1/doctors');
      const json = await res.json();
      if (json.success) setDoctors(json.data);
    } catch (err) {
      console.error("Failed to fetch doctors", err);
    }
  };

  useEffect(() => {
    if (!hasModule("MODULE_SURGERY")) return;
    (async () => {
      await Promise.all([fetchSurgeries(), fetchDoctors()]);
    })();
  }, [hasModule]);

  const doctorName = (id: string | null) => (id ? doctorsById.get(id)?.fullName ?? id : "—");

  const handleStart = async (surgery: Surgery) => {
    try {
      const res = await fetch(`/api/v1/surgeries/${surgery.id}/start`, { method: 'PATCH' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert(payload?.error || t('start_error'));
        return;
      }
      fetchSurgeries();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = () => {
     let csvContent = [
      [`Organization: ${tc('app_name')} HMS`, "123 Health Ave", "+1 234 567 8900", ""],
      [""],
      ["ID", tc('patient'), tc('ipp'), t('surgeon'), t('anesthesiologist'), t('room'), t('procedure_type'), tc('status'), tc('date')]
     ];
     surgeries.forEach(s => {
       csvContent.push([
         s.id, `"${s.patient.firstName} ${s.patient.lastName}"`, s.patient.ipp,
         `"${doctorName(s.surgeonId)}"`, `"${doctorName(s.anesthesiologistId)}"`, s.roomId ?? "",
         `"${s.procedureLabel}"`, s.status, s.scheduledAt ?? ""
       ]);
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
            <h2 className="text-lg font-semibold text-slate-900">{tc('restricted_access')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('module_desc')}</p>
            <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
               {tc('contact_admin')}
            </p>
         </div>
      </div>
    );
  }

  const filteredSurgeries = surgeries.filter(s => {
    if (filter !== "All" && s.status !== filter) return false;
    const patientName = `${s.patient.firstName} ${s.patient.lastName}`.toLowerCase();
    if (search && !patientName.includes(search.toLowerCase()) && !s.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusBadgeClass = (status: SurgicalStatus) => cn(
    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
    status === "scheduled" ? "bg-slate-100 text-slate-600" :
    status === "in_progress" ? "bg-blue-100 text-blue-700 blink-pulse" :
    status === "completed" ? "bg-green-100 text-green-700" :
    status === "postponed" ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700"
  );

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
           <a href={`mailto:?subject=Surgical Block Schedule&body=Please find the attached surgical schedule.%0A%0AOrganization: MedCore HMS%0A123 Health Ave, Medical City`} className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
             <Mail className="h-3.5 w-3.5 mr-2" /> Email
           </a>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={() => setIsScheduleOpen(true)}>
             <Plus className="mr-2 h-3.5 w-3.5" /> {t('schedule_intervention')}
           </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("scheduled")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('scheduled')}</div>
            <div className="text-3xl font-bold text-slate-900">{surgeries.filter(e => e.status === 'scheduled').length}</div>
          </div>
          <Clock className="h-8 w-8 text-slate-200" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("in_progress")}>
          <div>
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">{t('in_progress')}</div>
            <div className="text-3xl font-bold text-blue-600">{surgeries.filter(e => e.status === 'in_progress').length}</div>
          </div>
          <Syringe className="h-8 w-8 text-blue-100" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("completed")}>
          <div>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">{t('completed')}</div>
            <div className="text-3xl font-bold text-green-600">{surgeries.filter(e => e.status === 'completed').length}</div>
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
                placeholder={tc('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
              />
            </div>
            <div className="flex bg-slate-200/50 p-1 rounded-md ml-4">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  className={cn("px-3 py-1 rounded text-xs font-semibold transition-colors", filter === s ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800")}
                  onClick={() => setFilter(s)}
                >
                  {s === "All" ? tc('all') : t(s)}
                </button>
              ))}
            </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
             <div className="flex items-center justify-center h-full text-slate-400">{tc('loading')}</div>
          ) : filteredSurgeries.length === 0 ? (
             <div className="flex items-center justify-center h-full text-slate-400 text-sm flex-col">
               <Scissors className="h-8 w-8 mb-2 opacity-50" />
               {t('no_interventions')}
             </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  <th className="p-4 font-semibold w-32">{t('intervention_id')}</th>
                  <th className="p-4 font-semibold w-48">{tc('patient')}</th>
                  <th className="p-4 font-semibold">{t('procedure_type')}</th>
                  <th className="p-4 font-semibold w-40">{t('surgeon')}</th>
                  <th className="p-4 font-semibold w-24">{t('room')}</th>
                  <th className="p-4 font-semibold w-32">{tc('status')}</th>
                  <th className="p-4 font-semibold text-right w-72">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredSurgeries.map((surg) => {
                  const checklist = surg.whoChecklist ?? {};
                  const readyToStart = isPhaseComplete("signIn", checklist.signIn) && isPhaseComplete("timeOut", checklist.timeOut);
                  const readyToComplete = isPhaseComplete("signOut", checklist.signOut);

                  return (
                  <TableRow key={surg.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="p-4">
                      <div className="font-mono text-xs font-medium text-slate-700">{surg.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{surg.scheduledAt ? format(new Date(surg.scheduledAt), "MMM d, HH:mm") : "—"}</div>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="text-sm font-semibold text-slate-900">{surg.patient.firstName} {surg.patient.lastName}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">IPP: {surg.patient.ipp}</div>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="text-sm text-slate-800">{surg.procedureLabel}</div>
                      {surg.status === 'scheduled' && !readyToStart && (
                        <span className="inline-flex items-center text-[10px] mt-1 text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                          <AlertCircle className="w-3 h-3 mr-1" /> {t('checklist_missing')}
                        </span>
                      )}
                      {surg.status === 'in_progress' && !readyToComplete && (
                        <span className="inline-flex items-center text-[10px] mt-1 text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                          <AlertCircle className="w-3 h-3 mr-1" /> {t('checklist_missing')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="p-4 text-sm text-slate-600 font-medium">
                      {doctorName(surg.surgeonId)}
                    </TableCell>
                    <TableCell className="p-4 text-sm text-slate-600">
                      {surg.roomId ?? "—"}
                    </TableCell>
                    <TableCell className="p-4">
                       <span className={statusBadgeClass(surg.status)}>{t(surg.status)}</span>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                       <div className="flex justify-end flex-wrap gap-1.5">
                         {surg.status === 'scheduled' && (
                           <>
                             {!readyToStart ? (
                                <Button variant="outline" size="sm" className="h-7 text-xs bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" onClick={() => setChecklistSurgery(surg)}>
                                  <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> {t('validate_who')}
                                </Button>
                             ) : (
                                <Button size="sm" className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleStart(surg)}>
                                  <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> {t('start_surgery')}
                                </Button>
                             )}
                             <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCancelPostpone({ surgery: surg, action: 'postpone' })}>
                               <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> {t('postpone')}
                             </Button>
                             <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => setCancelPostpone({ surgery: surg, action: 'cancel' })}>
                               <XCircle className="w-3.5 h-3.5 mr-1.5" /> {t('cancel_surgery')}
                             </Button>
                           </>
                         )}
                         {surg.status === 'in_progress' && (
                            !readyToComplete ? (
                              <Button variant="outline" size="sm" className="h-7 text-xs bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" onClick={() => setChecklistSurgery(surg)}>
                                <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> {t('validate_who')}
                              </Button>
                            ) : (
                              <Button size="sm" className="h-7 text-xs bg-green-600 text-white hover:bg-green-700" onClick={() => setCompleteSurgery(surg)}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {t('complete_sign')}
                              </Button>
                            )
                         )}
                         {surg.status === 'postponed' && (
                           <Button size="sm" className="h-7 text-xs bg-amber-600 text-white hover:bg-amber-700" onClick={() => setRescheduleSurgery(surg)}>
                             <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> {t('reschedule_surgery')}
                           </Button>
                         )}
                       </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ScheduleSurgerySheet
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        doctors={doctors}
        onScheduled={fetchSurgeries}
      />
      <ChecklistSheet
        key={checklistSurgery?.id ?? "checklist"}
        open={Boolean(checklistSurgery)}
        onOpenChange={(open) => !open && setChecklistSurgery(null)}
        surgery={checklistSurgery}
        onUpdated={async () => {
          const list = await fetchSurgeries();
          setChecklistSurgery((prev) => (prev ? list.find((s) => s.id === prev.id) ?? null : null));
        }}
      />
      <CompleteSurgerySheet
        open={Boolean(completeSurgery)}
        onOpenChange={(open) => !open && setCompleteSurgery(null)}
        surgery={completeSurgery}
        onCompleted={fetchSurgeries}
      />
      <CancelPostponeDialog
        open={Boolean(cancelPostpone)}
        onOpenChange={(open) => !open && setCancelPostpone(null)}
        surgery={cancelPostpone?.surgery ?? null}
        action={cancelPostpone?.action ?? 'cancel'}
        onDone={fetchSurgeries}
      />
      <RescheduleDialog
        open={Boolean(rescheduleSurgery)}
        onOpenChange={(open) => !open && setRescheduleSurgery(null)}
        surgery={rescheduleSurgery}
        onRescheduled={fetchSurgeries}
      />
    </div>
  );
}
