"use client";

import { useTranslations } from "next-intl";
import { isConfidentialResult } from "@/lib/hiv/confidential-flag";
import { format } from "date-fns";
import { AlertTriangle, ExternalLink, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExamParametersTable } from "@/components/shared/exam-parameters-editor";
import type { StayExamRequest } from "../types";

type ValidatedResult = NonNullable<StayExamRequest["results"]>[number];

// The result the doctor may read from the admission: the latest one, and only once the
// biologist / radiologist has signed it off — a draft still being entered or awaiting
// validation is not clinically usable, the same rule the printed medical record applies.
export function getValidatedResult(order: StayExamRequest): ValidatedResult | null {
  const result = order.results?.[0];
  return order.status === "completed" && result?.validatedAt ? result : null;
}

// reportUrl is free text stored on the result, so only ever render it as a link when it is
// a plain http(s) URL — never a javascript: or data: URL.
function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

// Read-only view of a completed lab / radiology order's validated result.
export function ExamResultSheet({
  order,
  onOpenChange,
  userNames,
}: {
  order: StayExamRequest | null;
  onOpenChange: (open: boolean) => void;
  userNames: Record<string, string>;
}) {
  const t = useTranslations("admissions");
  const tr = useTranslations("radiology");
  const tc = useTranslations("common");

  const result = order ? getValidatedResult(order) : null;
  const data = result?.resultData;
  const parameters = data?.parameters ?? [];
  const reportUrl = safeExternalUrl(result?.reportUrl);
  const hasDetails = parameters.length > 0 || Boolean(data?.technique || data?.findings || data?.impression);
  const name = (userId: string | null | undefined) => (userId ? userNames[userId] ?? "—" : "—");

  return (
    <Sheet open={Boolean(order && result)} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col bg-slate-50">
        {order && result && (
          <>
            <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
              <SheetTitle className="text-lg flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-green-600" /> {order.examLabel}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {t("exam_result_title")} · {t(`order_type_${order.type}`)} · <span className="font-mono">{order.examCode}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {result.isCritical && (
                <div className="flex items-center gap-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {t("critical_result")}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white rounded border border-slate-200 shadow-sm p-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{t("result_performed_by")}</div>
                  <div className="text-slate-800">{name(result.performerId)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{t("result_validated_by")}</div>
                  <div className="text-slate-800">{name(result.validatedBy)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{t("result_validated_at")}</div>
                  <div className="text-slate-800 font-mono">{result.validatedAt ? format(new Date(result.validatedAt), "dd/MM/yyyy HH:mm") : "—"}</div>
                </div>
              </div>

              {parameters.length > 0 && (
                <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                  <ExamParametersTable parameters={parameters} />
                </div>
              )}

              {(data?.technique || data?.findings || data?.impression) && (
                <div className="bg-white rounded border border-slate-200 shadow-sm p-4 space-y-3 text-xs">
                  {data?.technique && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{tr("technique")}</div>
                      <p className="text-slate-700 whitespace-pre-wrap">{data.technique}</p>
                    </div>
                  )}
                  {data?.findings && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{tr("findings")}</div>
                      <p className="text-slate-700 whitespace-pre-wrap">{data.findings}</p>
                    </div>
                  )}
                  {data?.impression && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{tr("impression")}</div>
                      <p className="text-slate-900 font-medium whitespace-pre-wrap">{data.impression}</p>
                    </div>
                  )}
                </div>
              )}

              {reportUrl && (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:underline text-xs font-semibold"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> {tr("view_images")}
                </a>
              )}

              {isConfidentialResult(data) && (
                <p className="text-xs italic text-violet-700 bg-violet-50 border border-violet-100 rounded p-2">{tc("confidential_result")}</p>
              )}
              {!hasDetails && !reportUrl && !isConfidentialResult(data) && (
                <div className="text-center py-8 text-slate-400 italic text-xs">{t("no_result_details")}</div>
              )}
            </div>

            <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
              <Button variant="outline" className="text-xs h-9" onClick={() => onOpenChange(false)}>{tc("close")}</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
