"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Loader2 } from "lucide-react";
import { RadiologyExam } from "../types";

export function ReportEntryDialog({
  open,
  onOpenChange,
  exam,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: RadiologyExam | null;
  onSaved: () => void;
}) {
  const t = useTranslations("radiology");
  const tc = useTranslations("common");

  const [technique, setTechnique] = useState("");
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [priorStudies, setPriorStudies] = useState<{ id: string; examLabel: string; requestedAt: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !exam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/patients/${exam.patientId}/exams?type=radiology&status=completed`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setPriorStudies(json.data.filter((e: { id: string }) => e.id !== exam.id));
        }
      } catch (err) {
        console.error("Failed to fetch prior studies", err);
      }
    })();
    return () => { cancelled = true; };
  }, [open, exam]);

  if (!exam) return null;

  const handleSave = async () => {
    if (!findings.trim() || !impression.trim()) {
      setError(t("findings_impression_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/radiology/${exam.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technique, findings, impression, isCritical, reportUrl: reportUrl || undefined }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("report_save_error"));
        return;
      }
      setTechnique("");
      setFindings("");
      setImpression("");
      setReportUrl("");
      setIsCritical(false);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("report_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col gap-0 border-0 outline-none">
        <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-slate-50 space-y-0">
          <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" /> {t("enter_report")}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 overflow-y-auto space-y-4 max-h-[70vh]">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          {priorStudies.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded p-3">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t("prior_studies")}</div>
              <ul className="space-y-1">
                {priorStudies.slice(0, 5).map((s) => (
                  <li key={s.id} className="text-xs text-slate-600 flex justify-between">
                    <span>{s.examLabel}</span>
                    <span className="text-slate-400">{format(new Date(s.requestedAt), "PPP")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Label>{t("technique")}</Label>
            <textarea
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 mt-1"
              placeholder={t("technique_placeholder")}
            />
          </div>
          <div>
            <Label>{t("findings")}</Label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={5}
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 mt-1"
              placeholder={t("findings_placeholder")}
            />
          </div>
          <div>
            <Label>{t("impression")}</Label>
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 mt-1"
              placeholder={t("impression_placeholder")}
            />
          </div>
          <div>
            <Label>{t("report_url")}</Label>
            <Input
              value={reportUrl}
              onChange={(e) => setReportUrl(e.target.value)}
              placeholder={t("report_url_placeholder")}
              className="h-9 text-xs mt-1"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={isCritical}
              onChange={(e) => setIsCritical(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {t("flag_critical")}
          </label>
        </div>

        <DialogFooter className="p-4 border-t border-slate-200 bg-slate-50">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">{tc("cancel")}</Button>
          <Button size="sm" disabled={isSaving} onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
            {t("save_report")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
