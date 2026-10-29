"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { AlertTriangle, Baby, Droplets, Loader2, PlayCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PREGNANCY_STATUSES, type PregnancyStatus } from "@/lib/radiology/safety";
import { RadiologyExam } from "../types";

interface PreExam {
  requirements: { pregnancy: boolean; renal: boolean; contrastAllergy: boolean };
  contrastAllergyMatches: string[];
  latestCreatinine: { value: string; unit: string; at: string } | null;
  // Older than the recent window (computed by the server).
  creatinineIsOld: boolean;
}

// Pre-exam safety check, then start. What has to be answered is decided by the server from the
// patient and the exam (/pre-exam); the start route checks it again.
export function StartExamDialog({
  open,
  onOpenChange,
  exam,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: RadiologyExam;
  onStarted: () => void;
}) {
  const t = useTranslations("radiology");
  const tc = useTranslations("common");

  const [preExam, setPreExam] = useState<PreExam | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pregnancy, setPregnancy] = useState<PregnancyStatus | "">("");
  const [justification, setJustification] = useState("");
  const [renalAssessed, setRenalAssessed] = useState(false);
  const [creatinine, setCreatinine] = useState("");
  const [egfr, setEgfr] = useState("");
  const [allergyAck, setAllergyAck] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setPreExam(null);
      setLoadError(false);
      try {
        const res = await fetch(`/api/v1/radiology/${exam.id}/pre-exam`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as PreExam;
        if (!cancelled) setPreExam(data);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, exam.id]);

  const req = preExam?.requirements;
  const nothingToCheck = req && !req.pregnancy && !req.renal && !req.contrastAllergy;

  const start = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/radiology/${exam.id}/start`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregnancy: req?.pregnancy ? { status: pregnancy, justification } : undefined,
          renal: req?.renal ? { assessed: renalAssessed, creatinineUmolL: creatinine || undefined, egfr: egfr || undefined } : undefined,
          contrastAllergyAcknowledged: req?.contrastAllergy ? allergyAck : undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = payload?.error as string | undefined;
        setError(code && t.has(`safety_errors.${code}`) ? t(`safety_errors.${code}`) : code || t("action_error"));
        return;
      }
      onStarted();
      onOpenChange(false);
    } catch {
      setError(t("action_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("pre_exam_title")}</DialogTitle>
          <DialogDescription>
            {exam.examLabel} — {exam.patient.firstName} {exam.patient.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          {loadError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{t("pre_exam_load_error")}</div>}
          {!preExam && !loadError && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          )}
          {nothingToCheck && <p className="rounded-lg bg-green-50 p-3 text-xs text-green-800">{t("pre_exam_nothing")}</p>}

          {req?.pregnancy && (
            <section className="rounded-lg border border-slate-200 p-3 space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Baby className="h-4 w-4 text-pink-600" /> {t("pregnancy_question")}
              </h4>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
                {PREGNANCY_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={pregnancy === status}
                    onClick={() => setPregnancy(status)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-xs font-medium",
                      pregnancy === status ? (status === "not_pregnant" ? "border-green-600 bg-green-50 text-green-800" : "border-amber-500 bg-amber-50 text-amber-800") : "border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {t(`pregnancy_status.${status}`)}
                  </button>
                ))}
              </div>
              {pregnancy && pregnancy !== "not_pregnant" && (
                <div className="space-y-1">
                  <Label className="text-xs">{t("pregnancy_justification")}</Label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    rows={2}
                    className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                    placeholder={t("pregnancy_justification_placeholder")}
                  />
                </div>
              )}
            </section>
          )}

          {req?.renal && (
            <section className="rounded-lg border border-slate-200 p-3 space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Droplets className="h-4 w-4 text-blue-600" /> {t("renal_title")}
              </h4>
              {preExam?.latestCreatinine ? (
                <p className={cn("text-xs", preExam.creatinineIsOld ? "text-amber-700" : "text-slate-600")}>
                  {t("latest_creatinine", {
                    value: `${preExam.latestCreatinine.value} ${preExam.latestCreatinine.unit}`,
                    date: format(new Date(preExam.latestCreatinine.at), "dd/MM/yyyy"),
                  })}
                  {preExam.creatinineIsOld && ` — ${t("creatinine_old")}`}
                </p>
              ) : (
                <p className="text-xs text-amber-700">{t("no_creatinine")}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t("creatinine_umol")}</Label>
                  <Input type="number" min={1} value={creatinine} onChange={(e) => setCreatinine(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">{t("egfr")}</Label>
                  <Input type="number" min={1} value={egfr} onChange={(e) => setEgfr(e.target.value)} className="h-9" />
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={renalAssessed} onChange={(e) => setRenalAssessed(e.target.checked)} className="mt-0.5 h-4 w-4" />
                {t("renal_assessed")}
              </label>
            </section>
          )}

          {req?.contrastAllergy && (
            <section className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <ShieldAlert className="h-4 w-4" /> {t("contrast_allergy_title")}
              </h4>
              <p className="text-xs text-red-800">{t("contrast_allergy_warning", { allergies: preExam?.contrastAllergyMatches.join(", ") ?? "" })}</p>
              <label className="flex items-start gap-2 text-xs text-red-900">
                <input type="checkbox" checked={allergyAck} onChange={(e) => setAllergyAck(e.target.checked)} className="mt-0.5 h-4 w-4" />
                {t("contrast_allergy_ack")}
              </label>
            </section>
          )}

          {req && (req.pregnancy || req.renal || req.contrastAllergy) && (
            <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {t("pre_exam_recorded")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={isSaving || !preExam} onClick={start} className="bg-blue-600 text-white hover:bg-blue-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            {t("start_exam")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
