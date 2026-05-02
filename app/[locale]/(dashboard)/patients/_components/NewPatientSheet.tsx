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
import { NewPatientForm } from "../types";

interface NewPatientSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NewPatientForm;
  onUpdateForm: <K extends keyof NewPatientForm>(key: K, value: NewPatientForm[K]) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
  canSubmit: boolean;
}

export function NewPatientSheet({
  open,
  onOpenChange,
  form,
  onUpdateForm,
  saving,
  error,
  onSubmit,
  canSubmit,
}: NewPatientSheetProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('register_title')}</SheetTitle>
          <SheetDescription className="text-xs">
            {t('register_desc')}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
          
          {/* Demographics */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('demographics')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('first_name')} *</label>
                <Input value={form.firstName} onChange={(e) => onUpdateForm("firstName", e.target.value)} placeholder={t('placeholder_first_name')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('last_name')} *</label>
                <Input value={form.lastName} onChange={(e) => onUpdateForm("lastName", e.target.value)} placeholder={t('placeholder_last_name')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('dob')} *</label>
                <Input type="date" value={form.birthDate} onChange={(e) => onUpdateForm("birthDate", e.target.value)} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 text-slate-700" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('gender')} *</label>
                <select
                  value={form.gender}
                  onChange={(e) => onUpdateForm("gender", e.target.value as NewPatientForm["gender"])}
                  className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">{tc('select_placeholder')}</option>
                  <option value="M">{t('gender_male')}</option>
                  <option value="F">{t('gender_female')}</option>
                  <option value="U">{t('gender_other')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('ssn')}</label>
                <Input value={form.nss} onChange={(e) => onUpdateForm("nss", e.target.value)} placeholder={t('placeholder_nss')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('blood_group')}</label>
                <select
                  value={form.bloodGroup}
                  onChange={(e) => onUpdateForm("bloodGroup", e.target.value)}
                  className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">{tc('unknown')}</option>
                  <option value="O+">O+</option><option value="O-">O-</option>
                  <option value="A+">A+</option><option value="A-">A-</option>
                  <option value="B+">B+</option><option value="B-">B-</option>
                  <option value="AB+">AB+</option><option value="AB-">AB-</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('contact_info')}</h4>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
              <Input type="tel" value={form.phone} onChange={(e) => onUpdateForm("phone", e.target.value)} placeholder={t('placeholder_phone')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('email')}</label>
              <Input type="email" value={form.email} onChange={(e) => onUpdateForm("email", e.target.value)} placeholder={t('placeholder_email')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('address')}</label>
              <textarea
                value={form.address}
                onChange={(e) => onUpdateForm("address", e.target.value)}
                className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                placeholder={t('placeholder_address')}
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('emergency_contact')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('name')}</label>
                <Input value={form.emergencyName} onChange={(e) => onUpdateForm("emergencyName", e.target.value)} placeholder={t('placeholder_contact_name')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('relationship')}</label>
                <select
                  value={form.emergencyRelation}
                  onChange={(e) => onUpdateForm("emergencyRelation", e.target.value)}
                  className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">{tc('select_placeholder')}</option>
                  <option value="Spouse">{t('relation_spouse')}</option>
                  <option value="Child">{t('relation_child')}</option>
                  <option value="Parent">{t('relation_parent')}</option>
                  <option value="Sibling">{t('relation_sibling')}</option>
                  <option value="Other">{t('relation_other')}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
              <Input type="tel" value={form.emergencyPhone} onChange={(e) => onUpdateForm("emergencyPhone", e.target.value)} placeholder={t('placeholder_phone')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
            </div>
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={!canSubmit || saving}>
            {saving ? tc('saving') : t('save_patient')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
