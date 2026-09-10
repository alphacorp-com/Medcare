"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, TestTube2 } from "lucide-react";
import { NewVisitDialog } from "./NewVisitDialog";
import { PrescribePtmeDialog } from "./PrescribePtmeDialog";
import { gestationalAgeFromLmp, PregnancyDetail } from "../../types";

export function AntenatalVisitsTab({
  pregnancy,
  onUpdated,
}: {
  pregnancy: PregnancyDetail;
  onUpdated: () => void;
}) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");

  const [isVisitOpen, setIsVisitOpen] = useState(false);
  const [isPtmeOpen, setIsPtmeOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{t("antenatal_visits")}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsPtmeOpen(true)}>
            <TestTube2 className="h-3.5 w-3.5 mr-2" /> {t("prescribe_ptme")}
          </Button>
          <Button size="sm" className="h-8 text-xs bg-pink-600 hover:bg-pink-700" onClick={() => setIsVisitOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_visit")}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
              <th className="px-4 py-2">{t("visit")}</th>
              <th className="px-4 py-2">{tc("date")}</th>
              <th className="px-4 py-2">{t("gestational_age")}</th>
              <th className="px-4 py-2">{t("vitals_bp")}</th>
              <th className="px-4 py-2">{t("weight_kg")}</th>
              <th className="px-4 py-2">{t("fetal_heart_rate")}</th>
              <th className="px-4 py-2">{t("prophylaxis")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pregnancy.antenatalVisits.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400 italic">{t("no_visits_yet")}</td></tr>
            ) : (
              pregnancy.antenatalVisits.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{t("visit_n", { n: v.visitNumber })}</td>
                  <td className="px-4 py-3 text-slate-600">{format(new Date(v.visitDate), "PPP")}</td>
                  <td className="px-4 py-3 text-slate-600">{t("weeks", { count: v.gestationalAgeWeeks })}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.bloodPressureSystolic && v.bloodPressureDiastolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.weight ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{v.fetalHeartRate ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {v.ironFolateGiven && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">Fe/Folate</span>}
                      {v.tetanusVaccineGiven && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">VAT</span>}
                      {v.malariaPreventionGiven && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">TPI</span>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {t("ptme_screening")}
        </div>
        {pregnancy.examRequests.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-400 italic text-xs">{t("no_ptme_tests")}</div>
        ) : (
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-slate-100">
              {pregnancy.examRequests.map((exam) => {
                const latestResult = exam.results[0];
                return (
                  <tr key={exam.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{exam.examLabel}</td>
                    <td className="px-4 py-3 text-slate-500">{format(new Date(exam.requestedAt), "PPP")}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                        exam.status === "completed" ? "bg-green-100 text-green-700" :
                        exam.status === "cancelled" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {latestResult?.isCritical && (
                        <span className="text-[10px] font-bold text-red-600 uppercase">{t("critical")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <NewVisitDialog
        open={isVisitOpen}
        onOpenChange={setIsVisitOpen}
        pregnancyId={pregnancy.id}
        suggestedGestationalAge={gestationalAgeFromLmp(pregnancy.lastMenstrualPeriod)}
        onSaved={onUpdated}
      />
      <PrescribePtmeDialog
        open={isPtmeOpen}
        onOpenChange={setIsPtmeOpen}
        patientId={pregnancy.patientId}
        pregnancyId={pregnancy.id}
        onSaved={onUpdated}
      />
    </div>
  );
}
