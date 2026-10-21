"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { apiFetch } from "@/lib/api-client";
import { AEFI_OUTCOMES } from "@/lib/epi/input";
import { cn } from "@/lib/utils";
import { EpiMonthPicker, currentMonth, epiSelectClass, useEpiApiError } from "./epi-shared";

// RMA3 III.6: AEFI (MAPI) of the month, each tied to its dose. They are declared from the
// patient record (vaccination list); here they are followed up (outcome).

type Aefi = {
  id: string;
  onsetAt: string;
  seriousness: "minor" | "serious";
  outcome: (typeof AEFI_OUTCOMES)[number];
  hospitalized: boolean;
  description: string;
  immunization: {
    antigenName: string;
    doseNumber: number;
    administeredAt: string;
    lotNumber: string | null;
    patient: { id: string; firstName: string; lastName: string; ipp: string };
  };
};

export function AefiTab({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("diseasePrograms.epi");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const apiError = useEpiApiError();
  const [month, setMonth] = useState(currentMonth);

  const query = useQuery({ queryKey: ["aefi", month], queryFn: () => apiFetch<{ data: Aefi[] }>(`/api/v1/aefi?month=${month}`) });
  const reports = query.data?.data ?? [];
  const update = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: Aefi["outcome"] }) =>
      apiFetch(`/api/v1/aefi/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["aefi"] }),
    onError: (error) => toast.error(apiError(error)),
  });

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <EpiMonthPicker month={month} onChange={setMonth} />
        <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs">
          {t("aefi_totals", { minor: reports.filter((r) => r.seriousness === "minor").length, serious: reports.filter((r) => r.seriousness === "serious").length })}
        </div>
        <p className="text-[11px] text-slate-500">{t("aefi_hint")}</p>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("aefi_onset")}</th>
              <th className="px-3 py-2">{t("aefi_patient")}</th>
              <th className="px-3 py-2">{t("aefi_dose")}</th>
              <th className="px-3 py-2">{t("aefi_seriousness")}</th>
              <th className="px-3 py-2">{t("aefi_description")}</th>
              <th className="px-3 py-2">{t("aefi_outcome")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.isPending && (
              <tr><td colSpan={6} className="py-6 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-slate-400" /></td></tr>
            )}
            {!query.isPending && reports.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">{t("aefi_empty")}</td></tr>
            )}
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 whitespace-nowrap">{format.dateTime(new Date(r.onsetAt), { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-3 py-2">
                  <Link href={`/patients/${r.immunization.patient.id}`} className="font-semibold text-blue-600 hover:underline">
                    {r.immunization.patient.firstName} {r.immunization.patient.lastName}
                  </Link>
                  <div className="font-mono text-[10px] text-slate-400">{r.immunization.patient.ipp}</div>
                </td>
                <td className="px-3 py-2">
                  {r.immunization.antigenName} ({t("aefi_dose_number", { dose: r.immunization.doseNumber })})
                  <div className="text-[10px] text-slate-400">
                    {format.dateTime(new Date(r.immunization.administeredAt), { dateStyle: "short" })}
                    {r.immunization.lotNumber ? ` · ${r.immunization.lotNumber}` : ""}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", r.seriousness === "serious" ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700")}>
                    {t(`aefi_${r.seriousness}`)}
                  </span>
                  {r.hospitalized && <div className="text-[10px] text-slate-500">{t("aefi_hospitalized")}</div>}
                </td>
                <td className="px-3 py-2 max-w-xs text-slate-700">{r.description}</td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <select
                      value={r.outcome}
                      onChange={(e) => update.mutate({ id: r.id, outcome: e.target.value as Aefi["outcome"] })}
                      aria-label={t("aefi_outcome")}
                      className={cn(epiSelectClass, "h-7")}
                    >
                      {AEFI_OUTCOMES.map((o) => (
                        <option key={o} value={o}>{t(`aefi_outcome_${o}`)}</option>
                      ))}
                    </select>
                  ) : (
                    t(`aefi_outcome_${r.outcome}`)
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
