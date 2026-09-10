"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  VaccineAntigen,
  NewImmunizationForm,
  NewMalariaCaseForm,
  NewTbCaseForm,
  NewTbFollowUpForm,
} from "../types";

// ── Immunization ─────────────────────────────────────────────────────────────

interface NewImmunizationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NewImmunizationForm;
  onUpdateForm: <K extends keyof NewImmunizationForm>(key: K, value: NewImmunizationForm[K]) => void;
  antigens: VaccineAntigen[];
  saving: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
}

export function NewImmunizationSheet({
  open, onOpenChange, form, onUpdateForm, antigens, saving, error, onSubmit,
}: NewImmunizationSheetProps) {
  const t = useTranslations('diseasePrograms.vaccination');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('new_dose')}</SheetTitle>
          <SheetDescription className="text-xs">{t('new_dose_desc')}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('antigen')}</label>
            <select
              value={form.antigenCode}
              onChange={(e) => onUpdateForm("antigenCode", e.target.value)}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">{tc('select_placeholder')}</option>
              {antigens.map((a) => (
                <option key={a.id} value={a.code}>{a.nameFr}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('dose_number')}</label>
              <Input type="number" min="1" value={form.doseNumber} onChange={(e) => onUpdateForm("doseNumber", e.target.value)} className="h-8 text-xs bg-white border-slate-200" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('date')}</label>
              <Input type="date" value={form.administeredAt} onChange={(e) => onUpdateForm("administeredAt", e.target.value)} className="h-8 text-xs bg-white border-slate-200" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('lot_number')}</label>
            <Input value={form.lotNumber} onChange={(e) => onUpdateForm("lotNumber", e.target.value)} className="h-8 text-xs bg-white border-slate-200 font-mono" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => onUpdateForm("notes", e.target.value)}
              className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            />
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={saving || !form.antigenCode}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Malaria case ──────────────────────────────────────────────────────────────

interface NewMalariaCaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NewMalariaCaseForm;
  onUpdateForm: <K extends keyof NewMalariaCaseForm>(key: K, value: NewMalariaCaseForm[K]) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
}

export function NewMalariaCaseSheet({
  open, onOpenChange, form, onUpdateForm, saving, error, onSubmit,
}: NewMalariaCaseSheetProps) {
  const t = useTranslations('diseasePrograms.malaria');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('new_case')}</SheetTitle>
          <SheetDescription className="text-xs">{t('new_case_desc')}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('test_type')}</label>
              <select value={form.testType} onChange={(e) => onUpdateForm("testType", e.target.value as NewMalariaCaseForm["testType"])} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="rdt">{t('test_rdt')}</option>
                <option value="microscopy">{t('test_microscopy')}</option>
                <option value="clinical_only">{t('test_clinical_only')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('result')}</label>
              <select value={form.result} onChange={(e) => onUpdateForm("result", e.target.value as NewMalariaCaseForm["result"])} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="pending">{t('result_pending')}</option>
                <option value="positive">{t('result_positive')}</option>
                <option value="negative">{t('result_negative')}</option>
              </select>
            </div>
          </div>

          {form.result === "positive" && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('severity')}</label>
              <select value={form.severity} onChange={(e) => onUpdateForm("severity", e.target.value as NewMalariaCaseForm["severity"])} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">{tc('select_placeholder')}</option>
                <option value="simple">{t('severity_simple')}</option>
                <option value="severe">{t('severity_severe')}</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isPregnant" checked={form.isPregnantAtDiagnosis} onChange={(e) => onUpdateForm("isPregnantAtDiagnosis", e.target.checked)} className="rounded border-slate-300 text-blue-600" />
            <label htmlFor="isPregnant" className="text-xs">{t('is_pregnant')}</label>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="treatedAct" checked={form.treatedWithAct} onChange={(e) => onUpdateForm("treatedWithAct", e.target.checked)} className="rounded border-slate-300 text-blue-600" />
            <label htmlFor="treatedAct" className="text-xs">{t('treated_with_act')}</label>
          </div>

          {form.treatedWithAct && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('treatment_drug')}</label>
              <Input value={form.treatmentDrugName} onChange={(e) => onUpdateForm("treatmentDrugName", e.target.value)} placeholder="ASAQ, Artéméther-Luméfantrine..." className="h-8 text-xs bg-white border-slate-200" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('notes')}</label>
            <textarea value={form.notes} onChange={(e) => onUpdateForm("notes", e.target.value)} className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400" />
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── TB case ───────────────────────────────────────────────────────────────────

interface NewTbCaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NewTbCaseForm;
  onUpdateForm: <K extends keyof NewTbCaseForm>(key: K, value: NewTbCaseForm[K]) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
}

export function NewTbCaseSheet({
  open, onOpenChange, form, onUpdateForm, saving, error, onSubmit,
}: NewTbCaseSheetProps) {
  const t = useTranslations('diseasePrograms.tuberculosis');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('new_case')}</SheetTitle>
          <SheetDescription className="text-xs">{t('new_case_desc')}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('case_type')}</label>
            <select value={form.caseType} onChange={(e) => onUpdateForm("caseType", e.target.value)} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="new_case">{t('case_type_new')}</option>
              <option value="relapse">{t('case_type_relapse')}</option>
              <option value="treatment_after_failure">{t('case_type_after_failure')}</option>
              <option value="treatment_after_loss_to_follow_up">{t('case_type_after_ltfu')}</option>
              <option value="transfer_in">{t('case_type_transfer_in')}</option>
              <option value="other">{tc('other')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('classification')}</label>
            <select value={form.classification} onChange={(e) => onUpdateForm("classification", e.target.value as NewTbCaseForm["classification"])} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="pulmonary_bacteriologically_confirmed">{t('tpb_plus')}</option>
              <option value="pulmonary_clinically_diagnosed">{t('tpb_minus')}</option>
              <option value="extrapulmonary">{t('tep')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('hiv_status')}</label>
            <select value={form.hivStatus} onChange={(e) => onUpdateForm("hivStatus", e.target.value as NewTbCaseForm["hivStatus"])} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="unknown">{t('hiv_unknown')}</option>
              <option value="positive">{t('hiv_positive')}</option>
              <option value="negative">{t('hiv_negative')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('treatment_regimen')}</label>
            <Input value={form.treatmentRegimen} onChange={(e) => onUpdateForm("treatmentRegimen", e.target.value)} placeholder="RHZE / RH..." className="h-8 text-xs bg-white border-slate-200" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('notes')}</label>
            <textarea value={form.notes} onChange={(e) => onUpdateForm("notes", e.target.value)} className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400" />
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── TB follow-up ──────────────────────────────────────────────────────────────

interface NewTbFollowUpSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NewTbFollowUpForm;
  onUpdateForm: <K extends keyof NewTbFollowUpForm>(key: K, value: NewTbFollowUpForm[K]) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
}

export function NewTbFollowUpSheet({
  open, onOpenChange, form, onUpdateForm, saving, error, onSubmit,
}: NewTbFollowUpSheetProps) {
  const t = useTranslations('diseasePrograms.tuberculosis');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-sm w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('add_follow_up')}</SheetTitle>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('control_point')}</label>
            <select value={form.controlPoint} onChange={(e) => onUpdateForm("controlPoint", e.target.value as NewTbFollowUpForm["controlPoint"])} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="m2">M2</option>
              <option value="m3">M3</option>
              <option value="m5">M5</option>
              <option value="m6">M6</option>
              <option value="other">{tc('other')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('sputum_result')}</label>
            <select value={form.sputumResult} onChange={(e) => onUpdateForm("sputumResult", e.target.value as NewTbFollowUpForm["sputumResult"])} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="not_done">{t('sputum_not_done')}</option>
              <option value="negative">{t('sputum_negative')}</option>
              <option value="positive">{t('sputum_positive')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('outcome_label')}</label>
            <select value={form.outcomeRecorded} onChange={(e) => onUpdateForm("outcomeRecorded", e.target.value)} className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">{t('outcome_not_final')}</option>
              <option value="cured">{t('outcome.cured')}</option>
              <option value="treatment_completed">{t('outcome.treatment_completed')}</option>
              <option value="treatment_failed">{t('outcome.treatment_failed')}</option>
              <option value="died">{t('outcome.died')}</option>
              <option value="lost_to_follow_up">{t('outcome.lost_to_follow_up')}</option>
              <option value="not_evaluated">{t('outcome.not_evaluated')}</option>
              <option value="transferred_out">{t('outcome.transferred_out')}</option>
            </select>
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
