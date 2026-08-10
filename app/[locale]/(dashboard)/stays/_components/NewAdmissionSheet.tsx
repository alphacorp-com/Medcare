"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { VitalsFields } from "@/components/shared/vitals-fields";
import { Department, Doctor, Bed, NewStayForm } from "../types";

interface NewAdmissionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  form,
  onUpdateForm,
  departments,
  doctors,
  beds,
  saving,
  error,
  onSubmit,
}: NewAdmissionSheetProps) {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const tp = useTranslations("patients");
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("new_admission")}</SheetTitle>
          <SheetDescription className="text-xs">{t("register_desc")}</SheetDescription>
        </SheetHeader>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          {/* Patient */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t("patient")}</label>
            <PatientSearchAutocomplete
              className="h-8 text-xs bg-white border-slate-200"
              onSelect={(patient: any) => onUpdateForm("patientId", patient.id)}
            />
            <button 
              className="text-xs text-blue-600 hover:underline mt-1 font-medium"
              onClick={() => router.push('/patients')}
            >
              + {tp("new_patient")}
            </button>
          </div>

          {/* Admission type */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {t("admission_type")}
            </label>
            <select
              value={form.type} 
              onChange={(e) => onUpdateForm("type", e.target.value as NewStayForm["type"])}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="emergency">{t("type_emergency")}</option>
              <option value="scheduled">{t("type_scheduled")}</option>
              <option value="day_care">{t("type_day_care")}</option>
              <option value="outpatient">{t("type_outpatient")}</option>
            </select>
          </div>

          {/* Chief complaint */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {t("chief_complaint")}
            </label>
            <textarea
              value={form.admissionReason}
              onChange={(e) => onUpdateForm("admissionReason", e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              placeholder="Patient reports chest pain..."
            />
          </div>

          {/* Vital signs */}
          <VitalsFields value={form.vitals} onChange={(next) => onUpdateForm("vitals", next)} />

          {/* Department */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {t("assigned_department")}
            </label>
            <select
              value={form.departmentId}
              onChange={(e) => onUpdateForm("departmentId", e.target.value)}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">{t("unassigned")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Attending Doctor */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {t("attending_doctor")}
            </label>
            <select
              value={form.attendingDoctorId}
              onChange={(e) => onUpdateForm("attendingDoctorId", e.target.value)}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">{t("unassigned")}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Bed */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {t("bed")}
            </label>
            <select
              value={form.bedId}
              onChange={(e) => onUpdateForm("bedId", e.target.value)}
              disabled={!form.departmentId}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">{form.departmentId ? t("unassigned") : t("select_department_first")}</option>
              {beds
                .filter((b) => b.departmentId === form.departmentId)
                .map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
            </select>
          </div>
        </div>

        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button
            variant="outline"
            className="text-xs h-8"
            onClick={() => onOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          <Button
            className="text-xs h-8 bg-blue-600 hover:bg-blue-700"
            onClick={onSubmit}
            disabled={saving || !form.patientId}
          >
            {saving ? "Creating..." : t("create")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
