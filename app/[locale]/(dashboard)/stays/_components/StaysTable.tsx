"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useRouter } from "@/i18n/routing";
import { TriageBadge } from "@/components/shared/triage-badge";
import { StayRow } from "../types";

interface StaysTableProps {
  stays: StayRow[];
  loading: boolean;
  error: string | null;
  view?: "all" | "triage";
}

export function StaysTable({ stays, loading, error, view = "all" }: StaysTableProps) {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const router = useRouter();

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-xs text-slate-500">Loading…</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-48 text-xs text-red-500">{error}</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
            <th className="px-4 py-2">{t("stay_number")}</th>
            <th className="px-4 py-2">{t("patient")}</th>
            <th className="px-4 py-2">{tc("type")}</th>
            <th className="px-4 py-2">{tc("admission_date")}</th>
            <th className="px-4 py-2">{tc("discharge_date")}</th>
            <th className="px-4 py-2">PMSI</th>
            <th className="px-4 py-2">{tc("status")}</th>
            <th className="px-4 py-2 text-right">{tc("actions")}</th>
          </tr>
        </thead>
        <tbody className="text-xs divide-y divide-slate-100">
          {stays.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-slate-500 italic">
                No stays found.
              </td>
            </tr>
          ) : (
            stays.map((stay) => (
              <tr
                key={stay.id}
                className="hover:bg-blue-50/50 cursor-pointer group"
                onClick={() => router.push(`/stays/${stay.id}`)}
              >
                <td className="px-4 py-3 font-mono text-slate-600">{stay.stayNumber}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {stay.patient.firstName} {stay.patient.lastName}
                  <span className="block text-[10px] text-slate-400 font-mono">{stay.patient.ipp}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                      stay.type === "emergency"
                        ? "bg-red-100 text-red-700"
                        : stay.type === "scheduled"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {t(`type_${stay.type}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {format(new Date(stay.admissionDate), "MMM d, yyyy HH:mm")}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {stay.dischargeDate
                    ? format(new Date(stay.dischargeDate), "MMM d, yyyy")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {stay.pmsiCode ? (
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold font-mono",
                      stay.pmsiValidated ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    )}>
                      {stay.pmsiCode}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {view === "triage" && stay.triageAcuity ? (
                    <TriageBadge acuity={stay.triageAcuity} />
                  ) : (
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-semibold",
                        stay.status === "in_progress"
                          ? "text-orange-700 bg-orange-100"
                          : stay.status === "discharged"
                          ? "text-green-700 bg-green-100"
                          : "text-slate-600 bg-slate-100"
                      )}
                    >
                      {tc(`status_${stay.status}`)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/stays/${stay.id}`);
                    }}
                  >
                    {tc("view")}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
