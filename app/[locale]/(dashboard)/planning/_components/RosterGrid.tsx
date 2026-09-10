"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { ScheduleEntry, StaffMember } from "../types";

const ACTIVE_STATUSES = new Set(["planned", "confirmed", "modified"]);

function shiftCellClass(schedule: ScheduleEntry) {
  if (schedule.status === "absent") return "bg-red-50 text-red-700 border-red-200";
  if (schedule.status === "replaced") return "bg-amber-50 text-amber-700 border-amber-200 border-dashed";
  if (schedule.shiftType === "off") return "bg-slate-50 text-slate-400 border-dashed border-slate-200";
  if (schedule.shiftType === "morning") return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
  if (schedule.shiftType === "afternoon") return "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100";
  if (schedule.shiftType === "night") return "bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700";
  return "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100";
}

export function RosterGrid({
  staff,
  weekDays,
  schedules,
  onCellClick,
  onShiftClick,
}: {
  staff: StaffMember[];
  weekDays: Date[];
  schedules: ScheduleEntry[];
  onCellClick: (userId: string, date: Date) => void;
  onShiftClick: (schedule: ScheduleEntry) => void;
}) {
  const t = useTranslations("planning");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");

  const schedulesFor = (userId: string, date: Date) =>
    schedules.filter((s) => s.userId === userId && format(new Date(s.date), "yyyy-MM-dd") === format(date, "yyyy-MM-dd"));

  const headcount = (date: Date) =>
    schedules.filter((s) => ACTIVE_STATUSES.has(s.status) && format(new Date(s.date), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")).length;

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-100 text-[10px] text-slate-500 uppercase font-bold sticky top-0 z-10 shadow-sm">
            <th className="px-4 py-3 border-b border-r border-slate-200 w-48 bg-slate-100">{t("staff_member")}</th>
            {weekDays.map((date, i) => (
              <th key={i} className="px-2 py-3 border-b border-r border-slate-200 text-center min-w-[120px] bg-slate-100">
                <div className="text-slate-400">{format(date, "EEE")}</div>
                <div className={cn("text-sm", format(date, "P") === format(new Date(), "P") ? "text-blue-600 font-black" : "text-slate-800")}>
                  {format(date, "dd")}
                </div>
                <div className="text-[9px] normal-case font-semibold text-slate-400 mt-0.5">{t("on_shift", { count: headcount(date) })}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-xs divide-y divide-slate-100">
          {staff.length === 0 ? (
            <tr>
              <td colSpan={weekDays.length + 1} className="text-center py-8 text-slate-400">{tc("no_data")}</td>
            </tr>
          ) : staff.map((member) => (
            <tr key={member.id} className="hover:bg-slate-50/50 group">
              <td className="px-4 py-3 border-r border-slate-100 bg-white">
                <div className="font-bold text-slate-900">{member.fullName}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{tr(member.role)}</div>
              </td>
              {weekDays.map((date, dayIndex) => {
                const entries = schedulesFor(member.id, date);
                return (
                  <td key={dayIndex} className="p-1.5 border-r border-slate-100 align-top">
                    <div
                      className={cn(
                        "rounded border p-2 text-[10px] font-bold min-h-[48px] flex flex-col justify-center items-center text-center cursor-pointer transition-colors gap-1",
                        entries.length === 0 && "bg-white border-dashed border-slate-200 text-slate-300 hover:bg-slate-50 hover:text-slate-400"
                      )}
                      onClick={() => (entries.length > 0 ? onShiftClick(entries[0]) : onCellClick(member.id, date))}
                    >
                      {entries.length === 0 ? (
                        "+"
                      ) : (
                        entries.map((entry) => (
                          <div key={entry.id} className={cn("rounded border px-1.5 py-1 w-full", shiftCellClass(entry))}>
                            {entry.status === "absent" ? (
                              <span className="flex items-center justify-center"><AlertCircle className="h-3 w-3 mr-1" /> {t("status.absent")}</span>
                            ) : (
                              <>
                                <div>{t(`shift_types.${entry.shiftType}`)}</div>
                                {entry.status === "replaced" && <div className="font-normal opacity-70">{t("status.replaced")}</div>}
                              </>
                            )}
                          </div>
                        ))
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
  );
}
