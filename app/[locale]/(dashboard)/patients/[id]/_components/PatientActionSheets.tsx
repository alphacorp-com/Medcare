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
import { format } from "date-fns";
import { VitalsFields } from "@/components/shared/vitals-fields";
import {
  EditPatientForm,
  NewStayForm,
  NewMedRecordForm,
  Department,
  Doctor,
  Bed,
  StayRow,
  PatientDetail
} from "../types";

interface EditPatientSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: EditPatientForm;
  onUpdateForm: <K extends keyof EditPatientForm>(key: K, value: EditPatientForm[K]) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
}

export function EditPatientSheet({
  open,
  onOpenChange,
  form,
  onUpdateForm,
  saving,
  error,
  onSubmit,
}: EditPatientSheetProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('edit_patient')}</SheetTitle>
          <SheetDescription className="text-xs">
            {t('edit_desc')}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 flex-1 overflow-y-auto space-y-8">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-4">{error}</div>
          )}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4">{t('demographics')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('first_name')} *</label>
                <Input value={form.firstName} onChange={(e) => onUpdateForm("firstName", e.target.value)} placeholder="eg. John" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('last_name')} *</label>
                <Input value={form.lastName} onChange={(e) => onUpdateForm("lastName", e.target.value)} placeholder="eg. Doe" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
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
                  onChange={(e) => onUpdateForm("gender", e.target.value as EditPatientForm["gender"])}
                  className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="M">{t('gender_male')}</option>
                  <option value="F">{t('gender_female')}</option>
                  <option value="U">{t('gender_other')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('ssn')}</label>
                <Input value={form.nss} onChange={(e) => onUpdateForm("nss", e.target.value)} placeholder="Optional" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('blood_group')}</label>
                <select
                  value={form.bloodGroup}
                  onChange={(e) => onUpdateForm("bloodGroup", e.target.value)}
                  className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Unknown</option>
                  <option value="O+">O+</option><option value="O-">O-</option>
                  <option value="A+">A+</option><option value="A-">A-</option>
                  <option value="B+">B+</option><option value="B-">B-</option>
                  <option value="AB+">AB+</option><option value="AB-">AB-</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4">{t('contact_info')}</h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
                <Input type="tel" value={form.phone} onChange={(e) => onUpdateForm("phone", e.target.value)} placeholder="+237 6..." className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('email')}</label>
                <Input type="email" value={form.email} onChange={(e) => onUpdateForm("email", e.target.value)} placeholder="patient@example.com" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('address')}</label>
                <textarea
                  value={form.address}
                  onChange={(e) => onUpdateForm("address", e.target.value)}
                  className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                  placeholder="Quartier, Ville, Pays"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4">{t('emergency_contact')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('name')}</label>
                <Input value={form.emergencyName} onChange={(e) => onUpdateForm("emergencyName", e.target.value)} placeholder="Contact Name" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('relationship')}</label>
                <select
                  value={form.emergencyRelation}
                  onChange={(e) => onUpdateForm("emergencyRelation", e.target.value)}
                  className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Select...</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Child">Child</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
              <Input type="tel" value={form.emergencyPhone} onChange={(e) => onUpdateForm("emergencyPhone", e.target.value)} placeholder="+237 6..." className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
            </div>
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface NewAdmissionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientDetail;
  form: NewStayForm;
  onUpdateForm: <K extends keyof NewStayForm>(key: K, value: NewStayForm[K]) => void;
  departments: Department[];
  doctors: Doctor[];
  beds: Bed[];
  saving: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
}

export function NewAdmissionSheet({
  open,
  onOpenChange,
  patient,
  form,
  onUpdateForm,
  departments,
  doctors,
  beds,
  saving,
  error,
  onSubmit,
}: NewAdmissionSheetProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const tad = useTranslations('admissions');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{tc('new_admission')}</SheetTitle>
          <SheetDescription className="text-xs">
            {t('new_admission_desc')}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-4">{error}</div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{tad('patient')}</label>
            <div className="h-8 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700">
              {patient.firstName} {patient.lastName} ({patient.ipp})
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('admission_type')}</label>
            <select
              value={form.type}
              onChange={(e) => onUpdateForm("type", e.target.value as NewStayForm["type"])}
              className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="emergency">{t('type_emergency')}</option>
              <option value="scheduled">{t('type_scheduled')}</option>
              <option value="day_care">{t('type_day_care')}</option>
              <option value="outpatient">{t('type_outpatient')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('chief_complaint')}</label>
            <textarea 
              value={form.admissionReason}
              onChange={(e) => onUpdateForm("admissionReason", e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              placeholder="Patient reports chest pain..."
            />
          </div>
          
          <VitalsFields value={form.vitals} onChange={(next) => onUpdateForm("vitals", next)} />

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('assigned_department')}</label>
            <select
              value={form.departmentId}
              onChange={(e) => { onUpdateForm("departmentId", e.target.value); onUpdateForm("bedId", ""); }}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">{t('unassigned')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{tad('attending_doctor')}</label>
            <select
              value={form.attendingDoctorId}
              onChange={(e) => onUpdateForm("attendingDoctorId", e.target.value)}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">{tad('unassigned')}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{tad('bed')}</label>
            <select
              value={form.bedId}
              onChange={(e) => onUpdateForm("bedId", e.target.value)}
              disabled={!form.departmentId}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">{form.departmentId ? tad('unassigned') : tad('select_department_first')}</option>
              {beds
                .filter((b) => b.departmentId === form.departmentId)
                .map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
            </select>
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface NewMedicalRecordSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NewMedRecordForm;
  onUpdateForm: <K extends keyof NewMedRecordForm>(key: K, value: NewMedRecordForm[K]) => void;
  stays: StayRow[];
  doctors: Doctor[];
  saving: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
}

export function NewMedicalRecordSheet({
  open,
  onOpenChange,
  form,
  onUpdateForm,
  stays,
  doctors,
  saving,
  error,
  onSubmit,
}: NewMedicalRecordSheetProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const trec = useTranslations('record');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{trec('new_medical_record')}</SheetTitle>
          <SheetDescription className="text-xs">
            {trec('new_medical_record_desc')}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-4">{error}</div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{trec('record_type')}</label>
            <select
              value={form.type}
              onChange={(e) => onUpdateForm("type", e.target.value as NewMedRecordForm["type"])}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="consultation">Consultation</option>
              <option value="observation">Observation</option>
              <option value="surgery_report">Surgery Report</option>
              <option value="discharge_letter">Discharge Letter</option>
              <option value="referral">Referral</option>
              <option value="nursing_note">Nursing Note</option>
              <option value="anesthesia">Anesthesia</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{trec('record_title')}</label>
            <Input
              value={form.title}
              onChange={(e) => onUpdateForm("title", e.target.value)}
              placeholder="e.g., Follow-up Consultation"
              className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{trec('record_content')}</label>
            <textarea
              value={form.content}
              onChange={(e) => onUpdateForm("content", e.target.value)}
              className="flex min-h-[150px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              placeholder="Clinical notes..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{trec('link_to_stay')}</label>
            <select
              value={form.stayId}
              onChange={(e) => onUpdateForm("stayId", e.target.value)}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">None</option>
              {stays.map(s => (
                <option key={s.id} value={s.id}>{s.stayNumber} ({format(new Date(s.admissionDate), "MMM d, yyyy")})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('author')}</label>
            <select
              value={form.authorId}
              onChange={(e) => onUpdateForm("authorId", e.target.value)}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">{tc('select_placeholder')}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="isSigned"
              checked={form.isSigned}
              onChange={(e) => onUpdateForm("isSigned", e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isSigned" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {trec('sign_record')}
            </label>
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={onSubmit} disabled={saving || !form.content || !form.authorId}>
            {saving ? tc('saving') : trec('save_record')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
