"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle, Plus } from "lucide-react";
import { PrescribeExamSheet } from "./_components/PrescribeExamSheet";
import { ExamDetailSheet } from "./_components/ExamDetailSheet";
import { deriveWorkflowState, LabExam, LabWorkflowState, UserRef } from "./types";

const FILTERS: (LabWorkflowState | "All" | "critical")[] = [
  "All", "pending_sample", "in_analysis", "awaiting_validation", "critical",
];

export default function LaboratoryPage() {
  const t = useTranslations('lab');
  const tc = useTranslations('common');
  const hasModule = useAppStore((state) => state.hasModule);

  const [filter, setFilter] = useState<LabWorkflowState | "All" | "critical">("All");
  const [search, setSearch] = useState("");
  const [exams, setExams] = useState<LabExam[]>([]);
  const [users, setUsers] = useState<UserRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<LabExam | null>(null);
  const [isPrescribeOpen, setIsPrescribeOpen] = useState(false);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const fetchExams = async (): Promise<LabExam[]> => {
    try {
      const res = await fetch('/api/v1/laboratory');
      const data = await res.json();
      const list: LabExam[] = Array.isArray(data) ? data : [];
      setExams(list);
      return list;
    } catch (err) {
      console.error("Failed to fetch lab exams", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/users');
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    if (!hasModule("MODULE_LAB")) return;
    (async () => {
      await Promise.all([fetchExams(), fetchUsers()]);
    })();
  }, [hasModule]);

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

  const withState = exams.map((ex) => ({ exam: ex, state: deriveWorkflowState(ex), critical: Boolean(ex.results[0]?.isCritical) }));

  const filtered = withState.filter(({ exam, state, critical }) => {
    if (filter === "critical" && !critical) return false;
    if (filter !== "All" && filter !== "critical" && state !== filter) return false;
    const patientName = `${exam.patient.firstName} ${exam.patient.lastName}`.toLowerCase();
    if (search && !patientName.includes(search.toLowerCase()) && !exam.examCode.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const count = (predicate: (s: LabWorkflowState) => boolean) => withState.filter((w) => predicate(w.state)).length;
  const criticalCount = withState.filter((w) => w.critical).length;

  const rowActionLabel = (state: LabWorkflowState) => {
    if (state === "pending_sample") return t("collect");
    if (state === "in_analysis") return t("enter_results");
    if (state === "awaiting_validation") return t("validate");
    return tc("view");
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-3 rounded border border-slate-200 shadow-sm shrink-0 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800">{t('title')}</h1>
            <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
          </div>

          <div className="mt-0 w-full lg:w-auto">
            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => setIsPrescribeOpen(true)} size="sm" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
                <Plus className="mr-2 h-3.5 w-3.5" /> {t('prescribe_exam')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 shrink-0">
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer sm:p-4" onClick={() => setFilter("pending_sample")}>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 sm:text-xs">{t('samples')}</div>
            <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{count((s) => s === 'pending_sample')}</div>
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer sm:p-4" onClick={() => setFilter("in_analysis")}>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 sm:text-xs">{t('in_analysis')}</div>
            <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{count((s) => s === 'in_analysis')}</div>
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer sm:p-4" onClick={() => setFilter("awaiting_validation")}>
          <div>
            <div className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wider mb-1 sm:text-xs">{t('pending_results')}</div>
            <div className="text-2xl font-bold text-yellow-600 sm:text-3xl">{count((s) => s === 'awaiting_validation')}</div>
          </div>
        </div>
        <div className="bg-red-50 p-3 rounded border border-red-200 shadow-sm flex items-end justify-between hover:border-red-300 transition-colors cursor-pointer sm:p-4" onClick={() => setFilter("critical")}>
          <div>
             <div className="text-[10px] font-semibold text-red-800 uppercase tracking-wider mb-1 sm:text-xs">{t('critical_results')}</div>
             <div className="text-2xl font-bold text-red-700 sm:text-3xl">{criticalCount}</div>
          </div>
          <AlertTriangle className="h-7 w-7 text-red-200 sm:h-8 sm:w-8" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
           <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder={tc('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-200/50 p-1 sm:flex sm:flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold sm:px-3", filter === f ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}
                >
                  {f === "All" ? tc('all') : f === "critical" ? t('critical_results') : t(f)}
                </button>
              ))}
            </div>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{t('exam_id')}</th>
                <th className="px-4 py-2">{tc('patient')}</th>
                <th className="px-4 py-2">{t('prescriber')}</th>
                <th className="px-4 py-2">{t('test_type')}</th>
                <th className="px-4 py-2">{t('priority')}</th>
                <th className="px-4 py-2">{tc('status')}</th>
                <th className="px-4 py-2 text-right">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">{tc('loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500 text-xs">{tc('no_data')}</td></tr>
              ) : filtered.map(({ exam, state, critical }) => (
                <tr key={exam.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => setSelectedExam(exam)}>
                  <td className="px-4 py-2 font-mono text-slate-600">
                    <div>{exam.examCode}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{format(new Date(exam.requestedAt), "MMM dd HH:mm")}</div>
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                       {exam.patient.firstName} {exam.patient.lastName} <span className="text-[10px] font-mono text-slate-400">({exam.patient.ipp})</span>
                       {critical && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{usersById.get(exam.prescriberId)?.fullName ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-900 font-medium">{exam.examLabel}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                       "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                       exam.urgency === 'stat' ? "bg-red-100 text-red-700" :
                       exam.urgency === 'urgent' ? "bg-yellow-100 text-yellow-700" :
                       "bg-slate-100 text-slate-600"
                    )}>
                      {t(exam.urgency)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn(
                       "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                       state === 'pending_sample' ? "bg-slate-100 text-slate-700" :
                       state === 'in_analysis' ? "bg-blue-100 text-blue-700" :
                       state === 'awaiting_validation' ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
                       state === 'completed' ? "bg-green-100 text-green-700" :
                       "bg-red-100 text-red-700"
                    )}>
                      {t(state)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                       className={cn(
                          "font-semibold px-3 py-1 rounded text-[11px]",
                          state === 'in_analysis' ? "bg-blue-600 text-white hover:bg-blue-700" :
                          state === 'awaiting_validation' ? "bg-yellow-500 text-white hover:bg-yellow-600" :
                          "text-blue-600 hover:bg-blue-50"
                       )}
                       onClick={(e) => { e.stopPropagation(); setSelectedExam(exam); }}
                    >
                      {rowActionLabel(state)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PrescribeExamSheet
        open={isPrescribeOpen}
        onOpenChange={setIsPrescribeOpen}
        onPrescribed={fetchExams}
      />

      <ExamDetailSheet
        open={Boolean(selectedExam)}
        onOpenChange={(open) => !open && setSelectedExam(null)}
        exam={selectedExam}
        usersById={usersById}
        onUpdated={async () => {
          const list = await fetchExams();
          setSelectedExam((prev) => (prev ? list.find((e) => e.id === prev.id) ?? null : null));
        }}
      />
    </div>
  );
}
