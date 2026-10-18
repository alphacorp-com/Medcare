"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Loader2 } from "lucide-react";
import { fetchExamCatalog } from "@/lib/exam-catalog/client";
import { blankRow, ExamParametersEditor, ParameterRow, rowsFromDefinitions, toResultParameters } from "@/components/shared/exam-parameters-editor";
import { LabExam } from "../types";

export function ResultEntryDialog({
  open,
  onOpenChange,
  exam,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: LabExam | null;
  onSaved: () => void;
}) {
  const t = useTranslations("lab");
  const tc = useTranslations("common");

  const [rows, setRows] = useState<ParameterRow[]>([blankRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remounted with key={exam.id} by the parent (ExamDetailSheet) each time a different
  // exam is opened, so it's safe to fetch-and-populate once on mount rather than
  // re-deriving from a prop on every render.
  useEffect(() => {
    (async () => {
      if (!exam) return;
      const panels = await fetchExamCatalog("laboratory");
      const panel = panels.find((p) => p.code === exam.examCode);
      if (panel && panel.parameters.length > 0) {
        setRows(rowsFromDefinitions(panel.parameters, exam.patient.gender));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!exam) return null;

  const handleSave = async () => {
    const cleanRows = toResultParameters(rows);
    if (cleanRows.length === 0) {
      setError(t("at_least_one_parameter"));
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/laboratory/${exam.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: cleanRows }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("results_save_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("results_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden flex flex-col gap-0 border-0 outline-none">
        <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-slate-50 space-y-0">
          <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" /> {t("enter_results")}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 overflow-y-auto space-y-3 max-h-[70vh]">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <ExamParametersEditor rows={rows} onChange={setRows} gender={exam.patient.gender} />
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">{tc("cancel")}</Button>
          <Button size="sm" disabled={isSaving} onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
            {t("save_results")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
