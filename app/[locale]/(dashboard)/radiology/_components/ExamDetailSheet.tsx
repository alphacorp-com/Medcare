"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { AlertTriangle, BellRing, Check, ExternalLink, FileSignature, Loader2, PlayCircle, ScanLine, X, XCircle } from "lucide-react";
import { deriveWorkflowState, RadiologyExam, UserRef } from "../types";
import { ScheduleExamDialog } from "./ScheduleExamDialog";
import { ReportEntryDialog } from "./ReportEntryDialog";
import { RejectReportDialog } from "./RejectReportDialog";
import { CancelExamDialog } from "./CancelExamDialog";
import { NotifyCriticalDialog } from "./NotifyCriticalDialog";

export function ExamDetailSheet({
  open,
  onOpenChange,
  exam,
  usersById,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: RadiologyExam | null;
  usersById: Map<string, UserRef>;
  onUpdated: () => void;
}) {
  const t = useTranslations("radiology");
  const tc = useTranslations("common");

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"start" | "validate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!exam) return null;

  const state = deriveWorkflowState(exam);
  const latestResult = exam.results[0] ?? null;
  const userName = (id: string) => usersById.get(id)?.fullName ?? id;

  const runAction = async (action: "start" | "validate") => {
    setBusyAction(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/radiology/${exam.id}/${action}`, { method: "PATCH" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("action_error"));
        return;
      }
      onUpdated();
    } catch (err) {
      setError(t("action_error"));
    } finally {
      setBusyAction(null);
    }
  };

  const statusBadgeClass = cn(
    "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
    state === "pending_schedule" ? "bg-slate-100 text-slate-700" :
    state === "scheduled" ? "bg-purple-100 text-purple-700" :
    state === "in_progress" ? "bg-blue-100 text-blue-700" :
    state === "awaiting_report" ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
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
                  {" • "}{t("prescribed_by", { name: userName(exam.prescriberId), date: format(new Date(exam.requestedAt), "PPP") })}
                  {exam.scheduledAt && <>{" • "}{t("scheduled_for", { date: format(new Date(exam.scheduledAt), "PPP 'at' p") })}</>}
                </SheetDescription>
              </div>
              {latestResult?.isCritical && (
                <div className="bg-red-50 text-red-700 px-3 py-1.5 rounded border border-red-200 flex items-center gap-2 text-xs font-bold shrink-0">
                  <AlertTriangle className="h-4 w-4" /> {t("critical_finding")}
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
              <div className="bg-red-50 border border-red-200 rounded p-3 flex items-center justify-between gap-3">
                <p className="text-xs text-red-800">
                  {latestResult.criticalNotifiedAt
                    ? t("critical_notified", {
                        name: latestResult.resultData.criticalCommunication?.notifiedTo ?? "—",
                        method: latestResult.resultData.criticalCommunication?.method ?? "—",
                        date: format(new Date(latestResult.criticalNotifiedAt), "PPP 'at' p"),
                      })
                    : t("critical_not_notified")}
                </p>
                {!latestResult.criticalNotifiedAt && (
                  <Button size="sm" className="h-7 text-xs bg-red-600 text-white hover:bg-red-700 shrink-0" onClick={() => setIsNotifyOpen(true)}>
                    <BellRing className="h-3.5 w-3.5 mr-1.5" /> {t("notify_critical")}
                  </Button>
                )}
              </div>
            )}

            {state === "pending_schedule" && (
              <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
                <ScanLine className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">{t("pending_schedule")}</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{t("pending_schedule_desc")}</p>
                <Button className="mt-4 text-xs h-8 bg-blue-600" onClick={() => setIsScheduleOpen(true)}>
                  {t("schedule_exam")}
                </Button>
              </div>
            )}

            {state === "scheduled" && (
              <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
                <ScanLine className="h-10 w-10 text-purple-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">{t("scheduled_desc")}</h3>
                <Button className="mt-4 text-xs h-8 bg-blue-600" disabled={busyAction === "start"} onClick={() => runAction("start")}>
                  {busyAction === "start" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <PlayCircle className="h-3.5 w-3.5 mr-2" />}
                  {t("start_exam")}
                </Button>
              </div>
            )}

            {(state === "in_progress" || state === "awaiting_report" || state === "completed") && (
              <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("report")}</div>
                  {state === "in_progress" && (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600" onClick={() => setIsReportOpen(true)}>
                      {t("enter_report")}
                    </Button>
                  )}
                </div>
                {latestResult ? (
                  <div className="p-4 space-y-3 text-xs">
                    {latestResult.resultData.technique && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t("technique")}</div>
                        <p className="text-slate-700 whitespace-pre-wrap">{latestResult.resultData.technique}</p>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t("findings")}</div>
                      <p className="text-slate-700 whitespace-pre-wrap">{latestResult.resultData.findings}</p>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t("impression")}</div>
                      <p className="text-slate-900 font-medium whitespace-pre-wrap">{latestResult.resultData.impression}</p>
                    </div>
                    {latestResult.reportUrl && (
                      <a
                        href={latestResult.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:underline text-xs font-semibold"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> {t("view_images")}
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-slate-400 italic text-xs">{t("no_report_logged")}</div>
                )}
              </div>
            )}

            {state === "cancelled" && (
              <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
                <XCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">{t("exam_cancelled")}</h3>
              </div>
            )}
          </div>

          <SheetFooter className="p-4 border-t border-slate-200 bg-slate-100 shrink-0 justify-between items-center flex-row">
            <div className="flex gap-2">
              {(state === "pending_schedule" || state === "scheduled" || state === "in_progress" || state === "awaiting_report") && (
                <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-800" onClick={() => setIsCancelOpen(true)}>
                  <X className="mr-2 h-4 w-4" /> {t("cancel_exam")}
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {state === "awaiting_report" && (
                <>
                  <Button variant="outline" className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setIsRejectOpen(true)}>
                    <X className="mr-2 h-3.5 w-3.5" /> {t("reject_report")}
                  </Button>
                  <Button className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white" disabled={busyAction === "validate"} onClick={() => runAction("validate")}>
                    {busyAction === "validate" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <FileSignature className="mr-2 h-3.5 w-3.5" />}
                    {t("validate_publish")}
                  </Button>
                </>
              )}
              {state === "completed" && (
                <span className="text-xs font-bold uppercase tracking-wider text-green-700 flex items-center px-4 py-1.5 bg-green-100 rounded border border-green-200">
                  <Check className="mr-2 h-4 w-4" /> {t("clinically_validated")}
                </span>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ScheduleExamDialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen} exam={exam} onScheduled={onUpdated} />
      <ReportEntryDialog key={exam.id} open={isReportOpen} onOpenChange={setIsReportOpen} exam={exam} onSaved={onUpdated} />
      <RejectReportDialog open={isRejectOpen} onOpenChange={setIsRejectOpen} exam={exam} onDone={onUpdated} />
      <CancelExamDialog open={isCancelOpen} onOpenChange={setIsCancelOpen} exam={exam} onDone={() => { onUpdated(); onOpenChange(false); }} />
      <NotifyCriticalDialog open={isNotifyOpen} onOpenChange={setIsNotifyOpen} exam={exam} onDone={onUpdated} />
    </>
  );
}
