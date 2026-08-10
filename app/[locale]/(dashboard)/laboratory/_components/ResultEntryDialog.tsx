"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Loader2, Plus, Trash2 } from "lucide-react";
import { fetchExamCatalog } from "@/lib/exam-catalog/client";
import { ResultFlag, ResultParameter } from "@/lib/laboratory/results";
import { LabExam } from "../types";

const FLAGS: ResultFlag[] = ["normal", "high", "low", "critical"];

const blankParameter = (): ResultParameter => ({ name: "", value: "", unit: "", referenceRange: "", flag: "normal" });

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

  const [rows, setRows] = useState<ResultParameter[]>([blankParameter()]);
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
        setRows(panel.parameters.map((p) => ({ name: p.name, value: "", unit: p.unit, referenceRange: p.referenceRange, flag: "normal" })));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!exam) return null;

  const updateRow = (index: number, field: keyof ResultParameter, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, blankParameter()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    const cleanRows = rows.filter((r) => r.name.trim() && r.value.trim());
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
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col gap-0 border-0 outline-none">
        <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-slate-50 space-y-0">
          <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" /> {t("enter_results")}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 overflow-y-auto space-y-3 max-h-[70vh]">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1.2fr_0.8fr_0.6fr_0.9fr_0.7fr_auto] gap-2 items-center">
                <Input
                  value={row.name}
                  onChange={(e) => updateRow(index, "name", e.target.value)}
                  placeholder={t("marker")}
                  className="h-8 text-xs"
                />
                <Input
                  value={row.value}
                  onChange={(e) => updateRow(index, "value", e.target.value)}
                  placeholder={t("value")}
                  className="h-8 text-xs font-mono"
                />
                <Input
                  value={row.unit}
                  onChange={(e) => updateRow(index, "unit", e.target.value)}
                  placeholder={t("unit")}
                  className="h-8 text-xs"
                />
                <Input
                  value={row.referenceRange}
                  onChange={(e) => updateRow(index, "referenceRange", e.target.value)}
                  placeholder={t("ref_range")}
                  className="h-8 text-xs"
                />
                <select
                  value={row.flag}
                  onChange={(e) => updateRow(index, "flag", e.target.value)}
                  className={`flex h-8 rounded-md border px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 ${
                    row.flag === "critical" ? "border-red-300 text-red-700 bg-red-50" : "border-slate-200 bg-white"
                  }`}
                >
                  {FLAGS.map((f) => (
                    <option key={f} value={f}>{t(`flags.${f}`)}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeRow(index)} className="text-slate-400 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <Button type="button" variant="ghost" size="sm" className="text-xs text-blue-600" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t("add_parameter")}
          </Button>
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
