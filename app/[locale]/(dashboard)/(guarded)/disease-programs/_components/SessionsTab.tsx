"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { EpiMonthPicker, currentMonth, epiSelectClass, useEpiApiError } from "./epi-shared";

// RMA3 III.1: vaccination sessions planned / held, fixed post or outreach.

type Session = {
  id: string;
  scheduledDate: string;
  strategy: "fixed" | "outreach";
  site: string;
  status: "planned" | "held" | "cancelled";
  notes: string | null;
  doses: number;
};

export function SessionsTab({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("diseasePrograms.epi");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const apiError = useEpiApiError();
  const [month, setMonth] = useState(currentMonth);
  const empty = { scheduledDate: "", strategy: "fixed" as Session["strategy"], site: "", notes: "" };
  const [form, setForm] = useState(empty);

  const key = ["vaccination-sessions", month];
  const query = useQuery({ queryKey: key, queryFn: () => apiFetch<{ data: Session[] }>(`/api/v1/vaccination-sessions?month=${month}`) });
  const sessions = query.data?.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["vaccination-sessions"] });

  const create = useMutation({
    mutationFn: () => apiFetch("/api/v1/vaccination-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm(empty);
      toast.success(t("saved"));
      return refresh();
    },
    onError: (error) => toast.error(apiError(error)),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Session["status"] }) =>
      apiFetch(`/api/v1/vaccination-sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: refresh,
    onError: (error) => toast.error(apiError(error)),
  });

  const totals = (strategy: Session["strategy"]) => ({
    planned: sessions.filter((s) => s.strategy === strategy).length,
    held: sessions.filter((s) => s.strategy === strategy && s.status === "held").length,
  });

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <EpiMonthPicker month={month} onChange={setMonth} />
        {(["fixed", "outreach"] as const).map((strategy) => (
          <div key={strategy} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-semibold text-slate-700">{t(`strategy_${strategy}`)}</span> :{" "}
            {t("sessions_totals", totals(strategy))}
          </div>
        ))}
      </div>

      {canEdit && (
        <form
          className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase text-slate-500">{t("session_date")}</span>
            <Input type="date" required value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="h-8 w-40 text-xs" />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase text-slate-500">{t("strategy")}</span>
            <select value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value as Session["strategy"] })} className={cn(epiSelectClass, "w-44")}>
              <option value="fixed">{t("strategy_fixed")}</option>
              <option value="outreach">{t("strategy_outreach")}</option>
            </select>
          </label>
          <label className="flex-1 min-w-48 space-y-1">
            <span className="block text-[10px] font-bold uppercase text-slate-500">{t("session_site")}</span>
            <Input required maxLength={150} value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder={t("session_site_placeholder")} className="h-8 text-xs" />
          </label>
          <Button type="submit" size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-xs" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />} {t("session_add")}
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("session_date")}</th>
              <th className="px-3 py-2">{t("strategy")}</th>
              <th className="px-3 py-2">{t("session_site")}</th>
              <th className="px-3 py-2">{t("session_status")}</th>
              <th className="px-3 py-2 text-right">{t("session_doses")}</th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.isPending && (
              <tr><td colSpan={6} className="py-6 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-slate-400" /></td></tr>
            )}
            {!query.isPending && sessions.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">{t("sessions_empty")}</td></tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">{format.dateTime(new Date(s.scheduledDate), { dateStyle: "medium", timeZone: "UTC" })}</td>
                <td className="px-3 py-2">{t(`strategy_${s.strategy}`)}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{s.site}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      s.status === "held" ? "bg-green-100 text-green-700" : s.status === "cancelled" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700"
                    )}
                  >
                    {t(`session_status_${s.status}`)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">{s.doses}</td>
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                  {canEdit && s.status === "planned" && (
                    <>
                      <button type="button" className="text-[11px] font-semibold text-green-700 hover:underline" onClick={() => setStatus.mutate({ id: s.id, status: "held" })}>
                        {t("session_mark_held")}
                      </button>
                      {s.doses === 0 && (
                        <button type="button" className="text-[11px] font-semibold text-slate-500 hover:underline" onClick={() => setStatus.mutate({ id: s.id, status: "cancelled" })}>
                          {t("session_cancel")}
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
