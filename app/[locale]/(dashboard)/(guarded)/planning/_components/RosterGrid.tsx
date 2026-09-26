"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertCircle, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
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

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

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
  const isMobile = useIsMobile();
  const todayIndex = weekDays.findIndex((date) => dayKey(date) === dayKey(new Date()));
  const [selectedDay, setSelectedDay] = useState(Math.max(todayIndex, 0));

  const schedulesFor = (userId: string, date: Date) =>
    schedules.filter((s) => s.userId === userId && format(new Date(s.date), "yyyy-MM-dd") === dayKey(date));

  const headcount = (date: Date) =>
    schedules.filter((s) => ACTIVE_STATUSES.has(s.status) && format(new Date(s.date), "yyyy-MM-dd") === dayKey(date)).length;

  const renderShift = (entry: ScheduleEntry) => (
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
  );

  if (isMobile) {
    // Day view: the week becomes a row of selectable days, then one card per staff member.
    const date = weekDays[Math.min(selectedDay, weekDays.length - 1)];

    return (
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 grid grid-cols-7 gap-1 border-b border-slate-200 bg-white p-2">
          {weekDays.map((day, index) => {
            const selected = index === selectedDay;
            const isToday = index === todayIndex;
            return (
              <button
                key={dayKey(day)}
                type="button"
                onClick={() => setSelectedDay(index)}
                className={cn(
                  "flex flex-col items-center rounded-xl py-1.5 transition-colors",
                  selected ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <span className={cn("text-[10px] uppercase", selected ? "text-blue-100" : "text-slate-400")}>{format(day, "EEE")}</span>
                <span className={cn("text-sm font-bold", !selected && isToday && "text-blue-600")}>{format(day, "dd")}</span>
                <span className={cn("text-[9px] font-semibold", selected ? "text-blue-100" : "text-slate-400")}>{headcount(day)}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2 p-3">
          {staff.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">{tc("no_data")}</p>
          ) : (
            staff.map((member) => {
              const entries = schedulesFor(member.id, date);
              return (
                <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{member.fullName}</p>
                    <p className="truncate text-[11px] text-slate-500">{tr(member.role)}</p>
                  </div>
                  {entries.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onCellClick(member.id, date)}
                      aria-label={t("assign_shift")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onShiftClick(entries[0])}
                      className="flex w-28 shrink-0 flex-col gap-1 text-center text-[11px] font-bold"
                    >
                      {entries.map(renderShift)}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

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
                      {entries.length === 0 ? "+" : entries.map(renderShift)}
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
