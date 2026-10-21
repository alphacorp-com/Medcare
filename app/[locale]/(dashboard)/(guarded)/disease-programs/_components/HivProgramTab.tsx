"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Loader2, Lock } from "lucide-react";
import { Link } from "@/i18n/routing";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { EpiMonthPicker, currentMonth } from "./epi-shared";

// Program view of HIV / PMTCT / hepatitis / STI (MODULE_HIV): ART cohort with lateness,
// screening register, exposed infants and hepatitis cases. Entry happens in the patient file.

type PatientRef = { id: string; firstName: string; lastName: string; ipp: string };
type Cohort = { id: string; patient: PatientRef; artStartDate: string; status: string; daysLate: number | null; lastVisit: { visitDate: string; regimenCode: string; nextAppointmentDate: string } | null };
type Test = { id: string; testType: string; testedAt: string; result: string; entryPoint: string; patient: PatientRef };
type Infant = { id: string; patient: PatientRef & { birthDate: string }; firstSeenAt: string; tests: { testType: string; testedAt: string; result: string }[] };
type HepCase = { id: string; type: string; diagnosedAt: string; treatmentStartedAt: string | null; curedAt: string | null; diedAt: string | null; patient: PatientRef };

type View = "cohort" | "register" | "infants" | "hepatitis";

function PatientLink({ p }: { p: PatientRef }) {
  return (
    <Link href={`/patients/${p.id}`} className="font-semibold text-blue-600 hover:underline">
      {p.firstName} {p.lastName} <span className="font-mono text-[10px] text-slate-400">{p.ipp}</span>
    </Link>
  );
}

export function HivProgramTab() {
  const t = useTranslations("diseasePrograms.hiv");
  const format = useFormatter();
  const [view, setView] = useState<View>("cohort");
  const [month, setMonth] = useState(currentMonth);
  const [lateOnly, setLateOnly] = useState(false);
  const day = (iso: string | null | undefined) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short", timeZone: "UTC" }) : "—");

  const cohort = useQuery({ queryKey: ["hiv", "cohort"], queryFn: () => apiFetch<{ data: Cohort[] }>("/api/v1/hiv/enrolments"), enabled: view === "cohort" });
  const register = useQuery({ queryKey: ["hiv", "register", month], queryFn: () => apiFetch<{ data: Test[] }>(`/api/v1/hiv/screening-tests?month=${month}`), enabled: view === "register" });
  const infants = useQuery({ queryKey: ["hiv", "infants"], queryFn: () => apiFetch<{ data: Infant[] }>("/api/v1/hiv/exposed-infants"), enabled: view === "infants" });
  const hepatitis = useQuery({ queryKey: ["hiv", "hepatitis"], queryFn: () => apiFetch<{ data: HepCase[] }>("/api/v1/hiv/hepatitis-cases"), enabled: view === "hepatitis" });
  const current = { cohort, register, infants, hepatitis }[view];

  const lateBadge = (c: Cohort) => {
    if (c.status !== "active") return <span className="text-slate-500">{t(`status_${c.status}`)}</span>;
    const d = c.daysLate ?? 0;
    if (d >= 90) return <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{t("ltfu")}</span>;
    if (d >= 30) return <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">{t("days_late", { days: d })}</span>;
    return <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{t("on_time")}</span>;
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-3">
      <p className="flex items-center gap-1.5 text-[11px] text-violet-800">
        <Lock className="h-3.5 w-3.5" /> {t("confidential_notice")} {t("program_hint")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-md bg-slate-100 p-0.5" role="tablist">
          {(["cohort", "register", "infants", "hepatitis"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("rounded px-3 py-1.5 text-xs font-semibold", view === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}
            >
              {t(`view_${v}`)}
            </button>
          ))}
        </div>
        {view === "register" && <EpiMonthPicker month={month} onChange={setMonth} />}
        {view === "cohort" && (
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} className="rounded border-slate-300" />
            {t("late_only")}
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        {current.isPending ? (
          <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
        ) : current.isError ? (
          <p className="p-4 text-xs text-red-600">{t("load_error")}</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-xs">
            <tbody className="divide-y divide-slate-100">
              {view === "cohort" &&
                (cohort.data?.data ?? [])
                  .filter((c) => !lateOnly || (c.status === "active" && (c.daysLate ?? 0) >= 30))
                  .map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2"><PatientLink p={c.patient} /></td>
                      <td className="px-3 py-2">{t("art_since", { date: day(c.artStartDate) })}</td>
                      <td className="px-3 py-2 text-slate-600">{c.lastVisit ? `${c.lastVisit.regimenCode} · ${t("next_appointment", { date: day(c.lastVisit.nextAppointmentDate) })}` : t("no_visit")}</td>
                      <td className="px-3 py-2 text-right">{lateBadge(c)}</td>
                    </tr>
                  ))}
              {view === "register" &&
                (register.data?.data ?? []).map((x) => (
                  <tr key={x.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{day(x.testedAt)}</td>
                    <td className="px-3 py-2"><PatientLink p={x.patient} /></td>
                    <td className="px-3 py-2">{t(`test_type_${x.testType}`)}</td>
                    <td className={cn("px-3 py-2 font-semibold", x.result === "positive" && "text-red-700")}>{t(`result_${x.result}`)}</td>
                    <td className="px-3 py-2 text-slate-500">{t(`entry_${x.entryPoint}`)}</td>
                  </tr>
                ))}
              {view === "infants" &&
                (infants.data?.data ?? []).map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2"><PatientLink p={i.patient} /></td>
                    <td className="px-3 py-2">{t("born_on", { date: day(i.patient.birthDate) })}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {i.tests.length === 0 ? t("no_pcr") : i.tests.map((x) => `${t(`test_type_${x.testType}`)} ${day(x.testedAt)} : ${t(`result_${x.result}`)}`).join(" · ")}
                    </td>
                  </tr>
                ))}
              {view === "hepatitis" &&
                (hepatitis.data?.data ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2"><PatientLink p={c.patient} /></td>
                    <td className="px-3 py-2">{t(`hep_${c.type}`)} — {t("diagnosed_on", { date: day(c.diagnosedAt) })}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {c.diedAt ? t("died") : c.curedAt ? t("cured") : c.treatmentStartedAt ? t("treated_since", { date: day(c.treatmentStartedAt) }) : t("not_treated")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
