"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { DepartmentRecord, StaffMember } from "../types";

const TYPE_COLORS: Record<string, string> = {
  emergency: "bg-red-50 text-red-700 border-red-100",
  surgery: "bg-blue-50 text-blue-700 border-blue-100",
  icu: "bg-purple-50 text-purple-700 border-purple-100",
  medicine: "bg-teal-50 text-teal-700 border-teal-100",
  pediatrics: "bg-pink-50 text-pink-700 border-pink-100",
  radiology: "bg-indigo-50 text-indigo-700 border-indigo-100",
  laboratory: "bg-cyan-50 text-cyan-700 border-cyan-100",
  pharmacy: "bg-emerald-50 text-emerald-700 border-emerald-100",
  admin: "bg-slate-100 text-slate-700 border-slate-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
};

export function DepartmentsGrid({
  departments,
  usersById,
  onEdit,
  onViewRoster,
}: {
  departments: DepartmentRecord[];
  usersById: Map<string, StaffMember>;
  onEdit: (department: DepartmentRecord) => void;
  onViewRoster: (department: DepartmentRecord) => void;
}) {
  const t = useTranslations("planning");
  const tc = useTranslations("common");

  if (departments.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">{tc("no_data")}</div>;
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => {
          const head = dept.headId ? usersById.get(dept.headId) : null;
          return (
            <div
              key={dept.id}
              className={cn(
                "border rounded p-4 shadow-sm hover:shadow hover:border-blue-300 transition-all cursor-pointer",
                dept.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"
              )}
              onClick={() => onEdit(dept)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{dept.name}</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{dept.code}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {dept.type && (
                    <span className={cn("px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border", TYPE_COLORS[dept.type])}>
                      {t(`department_types.${dept.type}`)}
                    </span>
                  )}
                  {!dept.isActive && (
                    <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-slate-200 text-slate-600">
                      {t("inactive")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2 min-h-[24px]">
                {head && (
                  <>
                    <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {head.fullName.charAt(0)}
                    </div>
                    <div className="text-xs text-slate-600"><span className="text-slate-400">{t("department_head")}:</span> {head.fullName}</div>
                  </>
                )}
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                <div className="text-xs font-semibold text-slate-700 flex items-center">
                  <Users className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> {t("staff_count", { count: dept._count.users })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-blue-600 p-0 hover:bg-transparent hover:underline"
                  onClick={(e) => { e.stopPropagation(); onViewRoster(dept); }}
                >
                  {t("view_roster")} &rarr;
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
