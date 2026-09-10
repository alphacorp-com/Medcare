"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, addDays, addWeeks, subWeeks, startOfWeek } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, Search, Plus, ChevronLeft, ChevronRight, UserMinus } from "lucide-react";
import { RosterGrid } from "./_components/RosterGrid";
import { AssignShiftSheet } from "./_components/AssignShiftSheet";
import { ShiftDetailSheet } from "./_components/ShiftDetailSheet";
import { DeclareAbsenceDialog } from "./_components/DeclareAbsenceDialog";
import { DepartmentsGrid } from "./_components/DepartmentsGrid";
import { DepartmentFormSheet } from "./_components/DepartmentFormSheet";
import { DepartmentRecord, ScheduleEntry, StaffMember } from "./types";

export default function PlanningPage() {
  const t = useTranslations('planning');
  const tc = useTranslations('common');
  const hasModule = useAppStore((state) => state.hasModule);

  const [activeTab, setActiveTab] = useState<"roster" | "departments">("roster");
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [users, setUsers] = useState<StaffMember[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [deptSearch, setDeptSearch] = useState("");

  const [assignRequest, setAssignRequest] = useState<{ userId: string; date: string; nonce: number } | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEntry | null>(null);
  const [isAbsenceOpen, setIsAbsenceOpen] = useState(false);
  const [deptFormRequest, setDeptFormRequest] = useState<{ department: DepartmentRecord | null; nonce: number } | null>(null);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const activeDepartments = useMemo(() => departments.filter((d) => d.isActive), [departments]);
  const departmentStaff = useMemo(
    () => users.filter((u) => u.departmentId === selectedDepartmentId && u.isActive),
    [users, selectedDepartmentId]
  );
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);

  const fetchDepartments = async (): Promise<DepartmentRecord[]> => {
    try {
      const res = await fetch("/api/v1/departments?includeInactive=true");
      const json = await res.json();
      const list: DepartmentRecord[] = json.success ? json.data : [];
      setDepartments(list);
      if (!selectedDepartmentId && list.length > 0) {
        setSelectedDepartmentId(list.find((d) => d.isActive)?.id ?? list[0].id);
      }
      return list;
    } catch (err) {
      console.error("Failed to fetch departments", err);
      return [];
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/v1/users");
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const fetchSchedules = async (): Promise<ScheduleEntry[]> => {
    if (!selectedDepartmentId) return [];
    try {
      const from = format(weekStart, "yyyy-MM-dd");
      const to = format(addDays(weekStart, 6), "yyyy-MM-dd");
      const res = await fetch(`/api/v1/planning/schedules?departmentId=${selectedDepartmentId}&from=${from}&to=${to}`);
      const data = await res.json();
      const list: ScheduleEntry[] = Array.isArray(data) ? data : [];
      setSchedules(list);
      return list;
    } catch (err) {
      console.error("Failed to fetch schedules", err);
      return [];
    }
  };

  useEffect(() => {
    if (!hasModule("MODULE_PLANNING")) return;
    (async () => {
      await Promise.all([fetchDepartments(), fetchUsers()]);
    })();
  }, [hasModule]);

  useEffect(() => {
    if (!hasModule("MODULE_PLANNING") || !selectedDepartmentId) return;
    (async () => {
      await fetchSchedules();
    })();
  }, [hasModule, selectedDepartmentId, weekStart]);

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

  const filteredDepartments = departments.filter((d) =>
    !deptSearch || d.name.toLowerCase().includes(deptSearch.toLowerCase()) || d.code.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const refreshAfterScheduleChange = async () => {
    const list = await fetchSchedules();
    setSelectedSchedule((prev) => (prev ? list.find((s) => s.id === prev.id) ?? null : null));
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
          <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-wrap gap-2">
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('department')}:</label>
                 <select
                   className="h-8 text-xs bg-white border border-slate-200 rounded px-3 py-1 font-semibold text-slate-700 focus:outline-none focus:border-blue-400"
                   value={selectedDepartmentId}
                   onChange={(e) => setSelectedDepartmentId(e.target.value)}
                 >
                   {activeDepartments.map(d => (
                     <option key={d.id} value={d.id}>{d.name}</option>
                   ))}
                 </select>
               </div>
               <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="h-8 px-2 text-slate-500" onClick={() => setWeekStart((prev) => subWeeks(prev, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                 <span className="text-sm font-bold text-slate-700">{t('week_of', { date: format(weekStart, "MMM dd, yyyy") })}</span>
                 <Button variant="outline" size="sm" className="h-8 px-2 text-slate-500" onClick={() => setWeekStart((prev) => addWeeks(prev, 1))}><ChevronRight className="h-4 w-4" /></Button>
               </div>
             </div>
             <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700" onClick={() => setIsAbsenceOpen(true)}>
                  <UserMinus className="h-3.5 w-3.5 mr-2" /> {t('declare_absence')}
                </Button>
                <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => setAssignRequest((prev) => ({ userId: "", date: "", nonce: (prev?.nonce ?? 0) + 1 }))}>
                  <Plus className="h-3.5 w-3.5 mr-2" /> {t('assign_shift')}
                </Button>
             </div>
          </div>

          <RosterGrid
            staff={departmentStaff}
            weekDays={weekDays}
            schedules={schedules}
            onCellClick={(userId, date) => setAssignRequest((prev) => ({ userId, date: format(date, "yyyy-MM-dd"), nonce: (prev?.nonce ?? 0) + 1 }))}
            onShiftClick={(schedule) => setSelectedSchedule(schedule)}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="relative w-96 flex-1">
                 <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                 <Input
                   type="search"
                   placeholder={tc('search')}
                   value={deptSearch}
                   onChange={(e) => setDeptSearch(e.target.value)}
                   className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
                 />
               </div>
               <Button size="sm" className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800 ml-4" onClick={() => setDeptFormRequest((prev) => ({ department: null, nonce: (prev?.nonce ?? 0) + 1 }))}>
                 <Plus className="h-3.5 w-3.5 mr-2" /> {t('add_department')}
               </Button>
           </div>
           <DepartmentsGrid
             departments={filteredDepartments}
             usersById={usersById}
             onEdit={(dept) => setDeptFormRequest((prev) => ({ department: dept, nonce: (prev?.nonce ?? 0) + 1 }))}
             onViewRoster={(dept) => { setSelectedDepartmentId(dept.id); setActiveTab("roster"); }}
           />
        </div>
      )}

      <AssignShiftSheet
        key={`assign-${assignRequest?.nonce ?? 0}`}
        open={Boolean(assignRequest)}
        onOpenChange={(open) => !open && setAssignRequest(null)}
        departmentId={selectedDepartmentId}
        staff={departmentStaff}
        defaultUserId={assignRequest?.userId}
        defaultDate={assignRequest?.date}
        onAssigned={fetchSchedules}
      />

      <ShiftDetailSheet
        key={`shift-${selectedSchedule?.id ?? "none"}`}
        open={Boolean(selectedSchedule)}
        onOpenChange={(open) => !open && setSelectedSchedule(null)}
        schedule={selectedSchedule}
        staff={departmentStaff}
        onUpdated={refreshAfterScheduleChange}
      />

      <DeclareAbsenceDialog
        open={isAbsenceOpen}
        onOpenChange={setIsAbsenceOpen}
        staff={departmentStaff}
        onDeclared={fetchSchedules}
      />

      <DepartmentFormSheet
        key={`dept-${deptFormRequest?.department?.id ?? "create"}-${deptFormRequest?.nonce ?? 0}`}
        open={Boolean(deptFormRequest)}
        onOpenChange={(open) => !open && setDeptFormRequest(null)}
        department={deptFormRequest?.department ?? null}
        staff={users.filter((u) => u.isActive)}
        onSaved={fetchDepartments}
      />
    </div>
  );
}
