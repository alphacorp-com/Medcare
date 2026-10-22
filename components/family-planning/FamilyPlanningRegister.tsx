"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/routing";
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";
import { FP_METHODS_BY_CODE } from "@/lib/family-planning/methods";
import { FpVisitDialog } from "./FpVisitDialog";

// Family planning register of a month with its key figures (visits, new users, users by
// method). The RMA3 II.1.5 tables come from the same records.

export type FpVisit = {
  id: string;
  patientId: string;
  visitDate: string;
  clientStatus: "new_user" | "continuing_user";
  counseled: boolean;
  methodCode: string | null;
  procedure: string | null;
  isPostpartum: boolean;
  referredByChw: boolean;
  sideEffects: string | null;
  nextDueDate: string | null;
  patient?: { id: string; firstName: string; lastName: string; ipp: string };
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

export function FamilyPlanningRegister() {
  const t = useTranslations("familyPlanning");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const canCreate = useAppStore((state) => state.hasPermission("MODULE_MATERNITY", "create"));
  const [month, setMonth] = useState(currentMonth);
  const [isOpen, setIsOpen] = useState(false);
  const queryKey = ["family-planning", month];
  const query = useQuery({ queryKey, queryFn: () => apiFetch<{ data: FpVisit[] }>(`/api/v1/family-planning/visits?month=${month}`) });
  const visits = useMemo(() => query.data?.data ?? [], [query.data]);

  const stats = useMemo(() => {
    const byMethod = new Map<string, Set<string>>();
    for (const v of visits) if (v.methodCode) byMethod.set(v.methodCode, (byMethod.get(v.methodCode) ?? new Set()).add(v.patientId));
    return {
      visits: visits.length,
      clients: new Set(visits.map((v) => v.patientId)).size,
      newUsers: new Set(visits.filter((v) => v.clientStatus === "new_user" && v.methodCode).map((v) => v.patientId)).size,
      byMethod: [...byMethod.entries()].map(([code, ids]) => ({ code, users: ids.size })).sort((a, b) => b.users - a.users),
    };
  }, [visits]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase text-slate-500">{t("month")}</span>
          <Input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-40 text-xs" />
        </label>
        {canCreate && (
          <Button size="sm" className="h-8 text-xs bg-pink-600 hover:bg-pink-700" onClick={() => setIsOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_visit")}
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["stat_visits", stats.visits],
          ["stat_clients", stats.clients],
          ["stat_new_users", stats.newUsers],
        ].map(([key, value]) => (
          <div key={key} className="bg-white p-4 rounded border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t(key as string)}</div>
            <div className="text-3xl font-bold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {stats.byMethod.length > 0 && (
        <div className="bg-white rounded border border-slate-200 shadow-sm p-3">
          <div className="text-[10px] font-bold uppercase text-slate-500 mb-2">{t("users_by_method")}</div>
          <div className="flex flex-wrap gap-2">
            {stats.byMethod.map((m) => (
              <span key={m.code} className="px-2 py-1 rounded bg-pink-50 text-pink-700 text-[11px]">
                {FP_METHODS_BY_CODE.get(m.code)?.label ?? m.code} : <b>{m.users}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2">{t("visit_date")}</th>
              <th className="px-4 py-2">{t("patient")}</th>
              <th className="px-4 py-2">{t("client_status")}</th>
              <th className="px-4 py-2">{t("method")}</th>
              <th className="px-4 py-2">{t("next_due_date")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline text-slate-400" /></td></tr>
            ) : visits.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">{t("no_visits")}</td></tr>
            ) : (
              visits.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 text-slate-600">{format.dateTime(new Date(v.visitDate), { dateStyle: "medium" })}</td>
                  <td className="px-4 py-2">
                    {v.patient && (
                      <Link href={`/patients/${v.patient.id}`} className="text-pink-700 hover:underline">
                        {v.patient.firstName} {v.patient.lastName}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{t(`status_${v.clientStatus}`)}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {v.methodCode ? FP_METHODS_BY_CODE.get(v.methodCode)?.label ?? v.methodCode : t("no_method")}
                    {v.procedure ? ` · ${t(`procedure_${v.procedure}`)}` : ""}
                    {v.isPostpartum ? ` · ${t("postpartum")}` : ""}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{v.nextDueDate ? format.dateTime(new Date(v.nextDueDate), { dateStyle: "medium", timeZone: "UTC" }) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isOpen && <FpVisitDialog onOpenChange={setIsOpen} onSaved={() => queryClient.invalidateQueries({ queryKey: ["family-planning"] })} />}
    </div>
  );
}

// The FP history of one patient (patient file), with a shortcut to record a consultation.
export function FamilyPlanningHistory({ patientId }: { patientId: string }) {
  const t = useTranslations("familyPlanning");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const canCreate = useAppStore((state) => state.hasPermission("MODULE_MATERNITY", "create"));
  const [isOpen, setIsOpen] = useState(false);
  const query = useQuery({ queryKey: ["family-planning", "patient", patientId], queryFn: () => apiFetch<{ data: FpVisit[] }>(`/api/v1/family-planning/visits?patientId=${patientId}`) });
  const visits = query.data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{t("history_title")}</h3>
        {canCreate && (
          <Button size="sm" className="h-8 text-xs bg-pink-600 hover:bg-pink-700" onClick={() => setIsOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_visit")}
          </Button>
        )}
      </div>
      {query.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : visits.length === 0 ? (
        <p className="text-xs italic text-slate-400">{t("no_history")}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
          {visits.map((v) => (
            <li key={v.id} className="px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold">{format.dateTime(new Date(v.visitDate), { dateStyle: "medium" })}</span>
              {" — "}
              {v.methodCode ? FP_METHODS_BY_CODE.get(v.methodCode)?.label ?? v.methodCode : t("no_method")}
              {v.procedure ? ` · ${t(`procedure_${v.procedure}`)}` : ""}
              {" · "}
              {t(`status_${v.clientStatus}`)}
              {v.nextDueDate && <span className="text-slate-500"> · {t("next_due_on", { date: format.dateTime(new Date(v.nextDueDate), { dateStyle: "medium", timeZone: "UTC" }) })}</span>}
              {v.sideEffects && <div className="text-[11px] text-amber-700">{t("side_effects")} : {v.sideEffects}</div>}
            </li>
          ))}
        </ul>
      )}
      {isOpen && <FpVisitDialog patientId={patientId} onOpenChange={setIsOpen} onSaved={() => queryClient.invalidateQueries({ queryKey: ["family-planning"] })} />}
    </div>
  );
}
