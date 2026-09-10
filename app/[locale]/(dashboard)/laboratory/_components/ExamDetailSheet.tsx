"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { AlertTriangle, Check, FileSignature, FlaskConical, Loader2, Printer, X, XCircle, BellRing } from "lucide-react";
import { deriveWorkflowState, LabExam, UserRef } from "../types";
import { ResultEntryDialog } from "./ResultEntryDialog";
import { RejectExamDialog } from "./RejectExamDialog";
import { CancelExamDialog } from "./CancelExamDialog";
import { notifyBillingGenerated } from "@/lib/billing/client";

export function ExamDetailSheet({
  open,
  onOpenChange,
  exam,
  usersById,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: LabExam | null;
  usersById: Map<string, UserRef>;
  onUpdated: () => void;
}) {
  const t = useTranslations("lab");
  const tc = useTranslations("common");

  const [isResultEntryOpen, setIsResultEntryOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"collect" | "validate" | "notify" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!exam) return null;

  const state = deriveWorkflowState(exam);
  const latestResult = exam.results[0] ?? null;
  const userName = (id: string) => usersById.get(id)?.fullName ?? id;

  const runAction = async (action: "collect" | "validate" | "notify") => {
    const endpoint = action === "notify" ? "notify-critical" : action;
    setBusyAction(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/laboratory/${exam.id}/${endpoint}`, { method: "PATCH" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || t("action_error"));
        return;
      }
      if (action === "validate") notifyBillingGenerated(payload?.billing, tc("invoice_generated"));
      onUpdated();
    } catch (err) {
      setError(t("action_error"));
    } finally {
      setBusyAction(null);
    }
  };

  const statusBadgeClass = cn(
    "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
    state === "pending_sample" ? "bg-slate-100 text-slate-700" :
    state === "in_analysis" ? "bg-blue-100 text-blue-700" :
    state === "awaiting_validation" ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
    state === "completed" ? "bg-green-100 text-green-700" :
    "bg-red-100 text-red-700"
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-lg flex items-center gap-2">
                  {exam.examLabel}
                  <span className={statusBadgeClass}>{t(state)}</span>
                  {exam.urgency !== "routine" && (
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                      exam.urgency === "stat" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {t(exam.urgency)}
                    </span>
                  )}
                </SheetTitle>
                <SheetDescription className="text-xs mt-1">
                  <span className="font-mono">{t("exam_code")}: {exam.examCode}</span>
                  {" • "}{t("prescribed_by", { name: userName(exam.prescriberId), date: format(new Date(exam.requestedAt), "PPP 'at' p") })}
                </SheetDescription>
              </div>
              {latestResult?.isCritical && (
                <div className="bg-red-50 text-red-700 px-3 py-1.5 rounded border border-red-200 flex items-center gap-2 text-xs font-bold shrink-0">
                  <AlertTriangle className="h-4 w-4" /> {t("critical_result")}
                </div>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
            )}

            <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                {exam.patient.firstName.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{exam.patient.firstName} {exam.patient.lastName}</div>
                <div className="text-[10px] font-mono text-slate-500">IPP: {exam.patient.ipp}</div>
              </div>
            </div>

            {latestResult?.isCritical && (
              <div className="bg-red-50 border border-red-200 rounded p-3 flex items-center justify-between">
                <p className="text-xs text-red-800">
                  {latestResult.criticalNotifiedAt
                    ? t("critical_notified", { date: format(new Date(latestResult.criticalNotifiedAt), "PPP 'at' p") })
                    : t("critical_not_notified")}
                </p>
                {!latestResult.criticalNotifiedAt && (
                  <Button size="sm" className="h-7 text-xs bg-red-600 text-white hover:bg-red-700 shrink-0" disabled={busyAction === "notify"} onClick={() => runAction("notify")}>
                    {busyAction === "notify" ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <BellRing className="h-3.5 w-3.5 mr-1.5" />}
                    {t("notify_critical")}
                  </Button>
                )}
              </div>
            )}

            {state === "pending_sample" && (
              <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
                <FlaskConical className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">{t("awaiting_sample")}</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{t("awaiting_sample_desc")}</p>
                <Button className="mt-4 text-xs h-8 bg-blue-600" disabled={busyAction === "collect"} onClick={() => runAction("collect")}>
                  {busyAction === "collect" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                  {t("mark_collected")}
                </Button>
              </div>
            )}

            {(state === "in_analysis" || state === "awaiting_validation" || state === "completed") && (
              <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("test_parameters")}</div>
                  {state === "in_analysis" && (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600" onClick={() => setIsResultEntryOpen(true)}>
                      {t("enter_results")}
                    </Button>
                  )}
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 text-[10px] text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">{t("marker")}</th>
                      <th className="px-4 py-2 font-semibold">{t("value")}</th>
                      <th className="px-4 py-2 font-semibold">{t("unit")}</th>
                      <th className="px-4 py-2 font-semibold">{t("ref_range")}</th>
                      <th className="px-4 py-2 font-semibold">{t("flag")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {latestResult ? (
                      latestResult.resultData.parameters.map((p, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                          <td className={cn("px-4 py-3 font-bold text-sm", p.flag === "critical" ? "text-red-600" : p.flag === "normal" ? "text-slate-700" : "text-orange-600")}>{p.value}</td>
                          <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                          <td className="px-4 py-3 text-slate-500">{p.referenceRange}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded font-bold uppercase text-[9px] tracking-wider",
                              p.flag === "critical" ? "bg-red-100 text-red-700" :
                              p.flag === "high" || p.flag === "low" ? "bg-orange-100 text-orange-700" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {t(`flags.${p.flag}`)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">{t("no_results_logged")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {state === "cancelled" && (
              <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
                <XCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">{t("exam_cancelled")}</h3>
              </div>
            )}
          </div>

          <SheetFooter className="flex flex-col gap-3 border-t border-slate-200 bg-slate-100 p-4 shrink-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button variant="ghost" size="sm" className="text-xs text-slate-600 hover:text-slate-900 w-full sm:w-auto justify-center" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> {t("print_detail")}
              </Button>
              {(state === "pending_sample" || state === "in_analysis" || state === "awaiting_validation") && (
                <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-800 w-full sm:w-auto justify-center" onClick={() => setIsCancelOpen(true)}>
                  <X className="mr-2 h-4 w-4" /> {t("cancel_exam")}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
              {state === "awaiting_validation" && (
                <>
                  <Button variant="outline" className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 w-full sm:w-auto justify-center" onClick={() => setIsRejectOpen(true)}>
                    <X className="mr-2 h-3.5 w-3.5" /> {t("reject_results")}
                  </Button>
                  <Button className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto justify-center" disabled={busyAction === "validate"} onClick={() => runAction("validate")}>
                    {busyAction === "validate" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <FileSignature className="mr-2 h-3.5 w-3.5" />}
                    {t("validate_publish")}
                  </Button>
                </>
              )}
              {state === "completed" && (
                <span className="text-xs font-bold uppercase tracking-wider text-green-700 flex items-center justify-center px-4 py-1.5 bg-green-100 rounded border border-green-200 w-full sm:w-auto">
                  <Check className="mr-2 h-4 w-4" /> {t("clinically_validated")}
                </span>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ResultEntryDialog
        key={exam.id}
        open={isResultEntryOpen}
        onOpenChange={setIsResultEntryOpen}
        exam={exam}
        onSaved={onUpdated}
      />
      <RejectExamDialog
        open={isRejectOpen}
        onOpenChange={setIsRejectOpen}
        exam={exam}
        onDone={onUpdated}
      />
      <CancelExamDialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        exam={exam}
        onDone={() => { onUpdated(); onOpenChange(false); }}
      />
    </>
  );
}
