"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { FP_CATEGORY_LABELS, FP_METHODS, FP_METHODS_BY_CODE, type FpMethodCategory } from "@/lib/family-planning/methods";
import { useMaternityError } from "@/components/maternity/use-maternity-error";

// A family planning consultation: assessment, counselling, method, implant / IUD procedure,
// follow-up (next due date, side effects). The server checks every field again.
const PROCEDURES = ["implant_insertion", "implant_removal", "iud_insertion", "iud_removal"] as const;
const selectClass = "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400";
const textareaClass = "flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400";
const CATEGORIES = Object.keys(FP_CATEGORY_LABELS) as FpMethodCategory[];

export function FpVisitDialog({ patientId: fixedPatientId, onOpenChange, onSaved }: { patientId?: string; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const t = useTranslations("familyPlanning");
  const tc = useTranslations("common");
  const errorMessage = useMaternityError();
  const [patientId, setPatientId] = useState(fixedPatientId ?? "");
  const [visitDate, setVisitDate] = useState("");
  const [clientStatus, setClientStatus] = useState("");
  const [counseled, setCounseled] = useState(true);
  const [methodCode, setMethodCode] = useState("");
  const [procedure, setProcedure] = useState("");
  const [isPostpartum, setIsPostpartum] = useState(false);
  const [referredByChw, setReferredByChw] = useState(false);
  const [contraindications, setContraindications] = useState("");
  const [sideEffects, setSideEffects] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = methodCode ? FP_METHODS_BY_CODE.get(methodCode) : undefined;
  // Only the procedures of the chosen method (removals stay possible without a method).
  const procedures = PROCEDURES.filter((p) => (p.endsWith("_removal") ? !method || p.startsWith(method.procedure ?? "") : method?.procedure === p.split("_")[0]));

  const handleSave = async () => {
    if (!patientId || !clientStatus) {
      setError(t("patient_and_status_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/family-planning/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          visitDate: visitDate || undefined,
          clientStatus,
          counseled,
          methodCode: methodCode || null,
          procedure: procedures.includes(procedure as (typeof PROCEDURES)[number]) ? procedure : null,
          isPostpartum,
          referredByChw,
          contraindications: contraindications || null,
          sideEffects: sideEffects || null,
          nextDueDate: nextDueDate || null,
          notes: notes || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(payload, t("save_error")));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError(t("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("new_visit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          {!fixedPatientId && (
            <div className="space-y-1">
              <Label>{t("patient")}</Label>
              <PatientSearchAutocomplete className="h-9 text-xs" onSelect={(patient) => setPatientId(patient?.id ?? "")} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>{t("visit_date")}</Label>
              <Input type="date" value={visitDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setVisitDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label>{t("client_status")}</Label>
              <select value={clientStatus} onChange={(e) => setClientStatus(e.target.value)} className={selectClass}>
                <option value="">{tc("select_placeholder")}</option>
                <option value="new_user">{t("status_new_user")}</option>
                <option value="continuing_user">{t("status_continuing_user")}</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("method")}</Label>
            <select value={methodCode} onChange={(e) => setMethodCode(e.target.value)} className={selectClass}>
              <option value="">{t("no_method")}</option>
              {CATEGORIES.map((category) => (
                <optgroup key={category} label={FP_CATEGORY_LABELS[category]}>
                  {FP_METHODS.filter((m) => m.category === category && (!isPostpartum || m.postpartum)).map((m) => (
                    <option key={m.code} value={m.code}>{m.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {procedures.length > 0 && (
            <div className="space-y-1">
              <Label>{t("procedure")}</Label>
              <select value={procedure} onChange={(e) => setProcedure(e.target.value)} className={selectClass}>
                <option value="">—</option>
                {procedures.map((p) => (
                  <option key={p} value={p}>{t(`procedure_${p}`)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={counseled} onChange={(e) => setCounseled(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("counseled")}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={isPostpartum} onChange={(e) => setIsPostpartum(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("postpartum")}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={referredByChw} onChange={(e) => setReferredByChw(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              {t("referred_by_chw")}
            </label>
          </div>
          <div className="space-y-1">
            <Label>{t("contraindications")}</Label>
            <textarea value={contraindications} maxLength={1000} onChange={(e) => setContraindications(e.target.value)} rows={2} className={textareaClass} />
          </div>
          <div className="space-y-1">
            <Label>{t("side_effects")}</Label>
            <textarea value={sideEffects} maxLength={1000} onChange={(e) => setSideEffects(e.target.value)} rows={2} className={textareaClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>{t("next_due_date")}</Label>
              <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("notes")}</Label>
            <textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} rows={2} className={textareaClass} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={isSaving} onClick={handleSave} className="bg-pink-600 text-white hover:bg-pink-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
