"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
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
  ImmunizationRow,
  NewAefiForm,
  NewImmunizationForm,
  NewMalariaCaseForm,
  NewTbCaseForm,
  NewTbFollowUpForm,
} from "../types";

// ── Immunization ─────────────────────────────────────────────────────────────

const EPI_ERROR_CODES = [
  "invalid_strategy",
  "invalid_population",
  "invalid_session",
  "invalid_immunization",
  "onset_before_dose",
  "future_date",
  "invalid_date",
  "invalid_seriousness",
  "invalid_outcome",
  "invalid_description",
] as const;

// Translates the EPI 400 codes (vaccination, AEFI); null for other errors.
export function useEpiErrorMessage() {
  const t = useTranslations("diseasePrograms.epi.errors");
  return (body: unknown): string | null => {
    const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
    return typeof code === "string" && (EPI_ERROR_CODES as readonly string[]).includes(code) ? t(code) : null;
  };
}

type SessionOption = { id: string; scheduledDate: string; strategy: "fixed" | "outreach"; site: string; status: "planned" | "held" | "cancelled" };

const selectClass = "flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400";

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

type VaccineLotOption = {
  id: string;
  itemName: string;
  lotNumber: string;
  expiryDate: string | null;
  quantity: number;
  dosesPerUnit: number;
  openVial: { id: string; dosesLeft: number; discardAt: string } | null;
};

export function NewImmunizationSheet({
  open, onOpenChange, form, onUpdateForm, antigens, saving, error, onSubmit,
}: NewImmunizationSheetProps) {
  const t = useTranslations('diseasePrograms.vaccination');
  const te = useTranslations('diseasePrograms.epi');
  const ts = useTranslations('stock');
  const tc = useTranslations('common');
  const format = useFormatter();

  // Sessions planned or held on the day of the dose: linking one sets the strategy.
  const sessionsQuery = useQuery({
    queryKey: ["vaccination-sessions", form.administeredAt.slice(0, 7)],
    queryFn: () => apiFetch<{ data: SessionOption[] }>(`/api/v1/vaccination-sessions?month=${form.administeredAt.slice(0, 7)}`),
    enabled: open && /^\d{4}-\d{2}-\d{2}$/.test(form.administeredAt),
  });
  const daySessions = (sessionsQuery.data?.data ?? []).filter(
    (s) => s.status !== "cancelled" && s.scheduledDate.slice(0, 10) === form.administeredAt
  );
  const linkedSession = daySessions.find((s) => s.id === form.sessionId);

  // Is the antigen supplied from the stock? Then the dose must come from one of its lots.
  const lotsQuery = useQuery({
    queryKey: ["vaccine-lots", form.antigenCode],
    queryFn: () => apiFetch<{ managed: boolean; data: VaccineLotOption[] }>(`/api/v1/stock/vaccine-lots?antigenCode=${encodeURIComponent(form.antigenCode)}`),
    enabled: open && Boolean(form.antigenCode),
  });
  const managed = lotsQuery.data?.managed ?? false;
  const lots = lotsQuery.data?.data ?? [];
  const selectedLot = lots.find((lot) => lot.id === form.stockLotId);
  // End of session / contamination: the vial's remaining doses are recorded as wasted.
  const discardVial = useMutation({
    mutationFn: (vialId: string) => apiFetch(`/api/v1/stock/open-vials/${vialId}/discard`, { method: "POST" }),
    onSuccess: () => lotsQuery.refetch(),
  });

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
              onChange={(e) => {
                onUpdateForm("antigenCode", e.target.value);
                onUpdateForm("stockLotId", "");
              }}
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
              <Input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.administeredAt}
                onChange={(e) => {
                  onUpdateForm("administeredAt", e.target.value);
                  onUpdateForm("sessionId", "");
                }}
                className="h-8 text-xs bg-white border-slate-200"
              />
            </div>
          </div>

          {daySessions.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{te('session')}</label>
              <select
                value={form.sessionId}
                onChange={(e) => {
                  const chosen = daySessions.find((s) => s.id === e.target.value);
                  onUpdateForm("sessionId", e.target.value);
                  if (chosen) onUpdateForm("strategy", chosen.strategy);
                }}
                className={selectClass}
              >
                <option value="">{te('no_session')}</option>
                {daySessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.site} — {te(`strategy_${s.strategy}`)}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{te('strategy')}</label>
              <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-200/50 p-1" role="radiogroup">
                {(["fixed", "outreach"] as const).map((strategy) => (
                  <button
                    key={strategy}
                    type="button"
                    role="radio"
                    aria-checked={form.strategy === strategy}
                    disabled={Boolean(linkedSession)}
                    onClick={() => onUpdateForm("strategy", strategy)}
                    className={`rounded px-2 py-1 text-[11px] font-semibold disabled:opacity-60 ${form.strategy === strategy ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
                  >
                    {te(`strategy_${strategy}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{te('population')}</label>
              <select value={form.populationGroup} onChange={(e) => onUpdateForm("populationGroup", e.target.value as NewImmunizationForm["populationGroup"])} className={selectClass}>
                <option value="">{te('population_previous')}</option>
                {(["general", "nomad", "pygmy", "refugee"] as const).map((group) => (
                  <option key={group} value={group}>{te(`population_${group}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {managed ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{ts('vaccine_lot')} <span className="text-red-600">*</span></label>
              {lots.length === 0 ? (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{ts('vaccine_no_lot')}</p>
              ) : (
                <select
                  value={form.stockLotId}
                  onChange={(e) => onUpdateForm("stockLotId", e.target.value)}
                  className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">{tc('select_placeholder')}</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lotNumber} — {lot.itemName} · {lot.openVial ? ts('vaccine_open_vial_option', { doses: lot.openVial.dosesLeft }) : ts('vaccine_vials_option', { vials: lot.quantity })} · {lot.expiryDate ? format.dateTime(new Date(lot.expiryDate), { dateStyle: "short", timeZone: "UTC" }) : ts('no_expiry')}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[10px] text-slate-400">{ts('vaccine_lot_hint')}</p>
              {selectedLot?.openVial && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-blue-100 bg-blue-50 p-2 text-[11px] text-blue-800">
                  <span>
                    {ts('vaccine_open_vial_info', {
                      doses: selectedLot.openVial.dosesLeft,
                      at: format.dateTime(new Date(selectedLot.openVial.discardAt), { dateStyle: "short", timeStyle: "short" }),
                    })}
                  </span>
                  <button
                    type="button"
                    className="font-semibold text-red-600 hover:underline disabled:opacity-50"
                    disabled={discardVial.isPending}
                    onClick={() => {
                      if (window.confirm(ts('open_vial_discard_confirm', { left: selectedLot.openVial!.dosesLeft }))) discardVial.mutate(selectedLot.openVial!.id);
                    }}
                  >
                    {ts('open_vial_discard')}
                  </button>
                </div>
              )}
              {selectedLot && !selectedLot.openVial && selectedLot.dosesPerUnit > 1 && (
                <p className="text-[11px] text-slate-500">{ts('vaccine_opens_vial', { doses: selectedLot.dosesPerUnit })}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('lot_number')}</label>
              <Input value={form.lotNumber} onChange={(e) => onUpdateForm("lotNumber", e.target.value)} className="h-8 text-xs bg-white border-slate-200 font-mono" />
            </div>
          )}

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
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={saving || !form.antigenCode || lotsQuery.isFetching || (managed && !form.stockLotId)}>
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

// ── AEFI (MAPI) ──────────────────────────────────────────────────────────────

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

interface AefiSheetProps {
  dose: ImmunizationRow | null;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  error: string | null;
  onSubmit: (form: NewAefiForm) => Promise<void>;
}

// Declares an adverse event following the given dose (the dose is the link, not a choice).
export function AefiSheet({ dose, onOpenChange, saving, error, onSubmit }: AefiSheetProps) {
  const te = useTranslations('diseasePrograms.epi');
  const tc = useTranslations('common');
  const empty = (): NewAefiForm => ({ onsetAt: nowLocal(), seriousness: "minor", outcome: "unknown", hospitalized: false, description: "" });
  const [form, setForm] = useState<NewAefiForm>(empty);
  const valid = form.onsetAt !== "" && form.description.trim() !== "";

  return (
    <Sheet open={Boolean(dose)} onOpenChange={(open) => { if (!open) setForm(empty()); onOpenChange(open); }}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{te('aefi_title')}</SheetTitle>
          <SheetDescription className="text-xs">
            {dose ? te('aefi_desc', { antigen: dose.antigenName, dose: dose.doseNumber, date: new Date(dose.administeredAt).toLocaleDateString() }) : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{te('aefi_onset')}</label>
            <Input type="datetime-local" max={nowLocal()} value={form.onsetAt} onChange={(e) => setForm({ ...form, onsetAt: e.target.value })} className="h-8 text-xs bg-white border-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{te('aefi_seriousness')}</label>
              <select value={form.seriousness} onChange={(e) => setForm({ ...form, seriousness: e.target.value as NewAefiForm["seriousness"] })} className={selectClass}>
                <option value="minor">{te('aefi_minor')}</option>
                <option value="serious">{te('aefi_serious')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{te('aefi_outcome')}</label>
              <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value as NewAefiForm["outcome"] })} className={selectClass}>
                {(["unknown", "recovering", "recovered", "sequelae", "death"] as const).map((o) => (
                  <option key={o} value={o}>{te(`aefi_outcome_${o}`)}</option>
                ))}
              </select>
            </div>
          </div>
          {form.seriousness === "serious" && <p className="text-[11px] text-orange-700 bg-orange-50 border border-orange-100 rounded p-2">{te('aefi_serious_hint')}</p>}
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={form.hospitalized} onChange={(e) => setForm({ ...form, hospitalized: e.target.checked })} className="rounded border-slate-300" />
            {te('aefi_hospitalized')}
          </label>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{te('aefi_description')}</label>
            <textarea
              value={form.description}
              maxLength={2000}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="flex min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            />
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-red-600 hover:bg-red-700" onClick={() => onSubmit(form).then(() => setForm(empty()))} disabled={saving || !valid}>
            {saving ? tc('saving') : te('aefi_submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
