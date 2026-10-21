"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DiagnosisEditor, Icd10Search, toDiagnosisPayload, type DiagnosisDraft, type Icd10Option } from "@/components/shared/diagnosis-editor";

type DischargeMode = "discharged" | "transferred" | "deceased";
const MODES: DischargeMode[] = ["discharged", "transferred", "deceased"];

// Body of PATCH /api/v1/stays/[id] built from this sheet's form, shared by every screen
// that discharges a patient.
export function dischargePayload(formData: FormData) {
  const json = (name: string) => {
    const raw = formData.get(name);
    if (typeof raw !== "string" || !raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  };
  return {
    status: (formData.get("status") as string) || "discharged",
    dischargeDate: new Date(formData.get("dischargeDate") as string).toISOString(),
    dischargeSummary: formData.get("dischargeSummary"),
    dischargeDiagnoses: json("dischargeDiagnoses"),
    causeOfDeath: json("causeOfDeath"),
  };
}

interface DischargeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  // The form posts `status`, `dischargeDiagnoses` and `causeOfDeath` (JSON) along with the
  // date and summary; the server re-checks every rule below.
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  // A hospitalized stay needs its principal discharge diagnosis (RMA3 V.4).
  hospitalized: boolean;
}

export function DischargeSheet({
  open,
  onOpenChange,
  submitting,
  onSubmit,
  hospitalized,
}: DischargeSheetProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  const td = useTranslations('diagnoses');
  const [mode, setMode] = useState<DischargeMode>("discharged");
  const [diagnoses, setDiagnoses] = useState<DiagnosisDraft[]>([]);
  const [causeOfDeath, setCauseOfDeath] = useState<Icd10Option | null>(null);

  const isDeath = mode === "deceased";
  const diagnosisRequired = hospitalized && !isDeath;
  const hasPrincipal = diagnoses.some((d) => d.kind === "principal");
  const canSubmit = (!diagnosisRequired || hasPrincipal) && (!isDeath || Boolean(causeOfDeath));

  const reset = () => {
    setMode("discharged");
    setDiagnoses([]);
    setCauseOfDeath(null);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <SheetContent className="sm:max-w-[450px] p-0 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-8 pb-32">
            <SheetHeader className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4 border border-red-100 shadow-sm">
                <LogOut className="h-6 w-6 text-red-600" />
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900">{t('discharge_patient')}</SheetTitle>
              <SheetDescription className="text-slate-500 leading-relaxed">{t('discharge_desc')}</SheetDescription>
            </SheetHeader>
            
            <form id="discharge-form" onSubmit={onSubmit} className="space-y-6">
              <input type="hidden" name="status" value={mode} />
              <input type="hidden" name="dischargeDiagnoses" value={JSON.stringify(toDiagnosisPayload(diagnoses))} />
              <input type="hidden" name="causeOfDeath" value={causeOfDeath ? JSON.stringify({ code: causeOfDeath.code }) : ""} />

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{td('discharge_mode')}</Label>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={td('discharge_mode')}>
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors",
                        mode === m
                          ? m === "deceased" ? "border-slate-800 bg-slate-800 text-white" : "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {td(`mode_${m}`)}
                    </button>
                  ))}
                </div>
              </div>

              {isDeath && (
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">
                    {td('cause_of_death')} <span className="text-red-600">*</span>
                  </Label>
                  {causeOfDeath ? (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="font-mono text-xs font-semibold text-blue-700">{causeOfDeath.code}</span>
                      <span className="flex-1 text-sm text-slate-800">{causeOfDeath.labelFr}</span>
                      <button type="button" className="text-xs font-semibold text-slate-500 hover:text-red-600" onClick={() => setCauseOfDeath(null)}>
                        {td('change')}
                      </button>
                    </div>
                  ) : (
                    <Icd10Search onSelect={setCauseOfDeath} invalid />
                  )}
                  <p className="text-[11px] text-slate-500">{td('cause_of_death_hint')}</p>
                </div>
              )}

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{td('discharge_diagnoses')}</Label>
                <DiagnosisEditor value={diagnoses} onChange={setDiagnoses} required={diagnosisRequired} principalLabel={td('discharge_principal')} />
              </div>
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('discharge_date_label')}</Label>
                <Input id="dischargeDate" name="dischargeDate" type="datetime-local" defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")} className="h-11 rounded-xl border-slate-200 focus:ring-slate-900" required />
              </div>
              
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('discharge_summary_label')}</Label>
                <textarea 
                  id="dischargeSummary" 
                  name="dischargeSummary" 
                  className="min-h-[250px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-all"
                  placeholder={t('discharge_summary_placeholder')}
                  required
                />
              </div>
            </form>
          </div>
        </ScrollArea>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          <Button form="discharge-form" type="submit" size="lg" className="h-12 w-full rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold shadow-lg shadow-red-100 transition-all active:scale-95 text-white" disabled={submitting || !canSubmit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
            {isDeath ? td('confirm_death') : t('confirm_discharge')}
          </Button>
          <Button variant="ghost" className="h-11 w-full rounded-xl text-slate-500 font-medium" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
