"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";

// Internal Components
import { StaysHeader } from "./_components/StaysHeader";
import { StaysFilterBar } from "./_components/StaysFilterBar";
import { StaysTable } from "./_components/StaysTable";
import { NewAdmissionSheet } from "./_components/NewAdmissionSheet";

// Types
import { StayRow, Department, Doctor, NewStayForm } from "./types";

export default function AdmissionsPage() {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const hasModule = useAppStore((state) => state.hasModule);

  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [isNewAdmissionOpen, setIsNewAdmissionOpen] = useState(false);

  // Data State
  const [stays, setStays] = useState<StayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Form State
  const [stayForm, setStayForm] = useState<NewStayForm>({
    patientId: "",
    type: "emergency",
    admissionReason: "",
    departmentId: "",
    bedId: "",
    attendingDoctorId: "",
  });
  const [savingStay, setSavingStay] = useState(false);
  const [stayError, setStayError] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const fetchStays = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/stays");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load stays");
      setStays(json.data as StayRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stays");
      setStays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStays();
    // Load reference data
    Promise.all([
      fetch("/api/v1/departments").then((r) => r.json()),
      fetch("/api/v1/doctors").then((r) => r.json()),
    ]).then(([deptJson, docJson]) => {
      if (deptJson.success) setDepartments(deptJson.data as Department[]);
      if (docJson.success) setDoctors(docJson.data as Doctor[]);
    });
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const updateStayForm = <K extends keyof NewStayForm>(key: K, value: NewStayForm[K]) => {
    setStayForm((prev) => ({ ...prev, [key]: value }));
  };

  const openNewAdmissionSheet = () => {
    setStayForm({
      patientId: "",
      type: "emergency",
      admissionReason: "",
      departmentId: "",
      bedId: "",
      attendingDoctorId: "",
    });
    setStayError(null);
    setIsNewAdmissionOpen(true);
  };

  const handleSaveStay = async () => {
    if (savingStay || !stayForm.patientId) return;
    setSavingStay(true);
    setStayError(null);
    try {
      const payload = {
        type: stayForm.type,
        admissionReason: stayForm.admissionReason || null,
        departmentId: stayForm.departmentId || null,
        bedId: stayForm.bedId || null,
        attendingDoctorId: stayForm.attendingDoctorId || null,
      };
      const res = await fetch(`/api/v1/patients/${stayForm.patientId}/stays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to create stay");
      setIsNewAdmissionOpen(false);
      await fetchStays();
    } catch (e) {
      setStayError(e instanceof Error ? e.message : "Failed to create stay");
    } finally {
      setSavingStay(false);
    }
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!hasModule("MODULE_ADMISSION")) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tc("restricted_access")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("module_desc")}</p>
          <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
            {tc("contact_admin")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <StaysHeader 
        onFilterToggle={() => setShowFilters(!showFilters)} 
        onNewAdmission={openNewAdmissionSheet} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <StaysFilterBar 
          showFilters={showFilters} 
          onFilterClose={() => setShowFilters(false)} 
        />

        <StaysTable 
          stays={stays} 
          loading={loading} 
          error={error} 
        />

        {/* Footer / Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <span>{stays.length} stay(s) total</span>
          <div className="flex gap-4">
            <span className="text-blue-600 font-semibold cursor-pointer">
              {tc("view")} {tc("all")}
            </span>
            <span className="text-blue-600 font-semibold cursor-pointer">{tc("print")}</span>
          </div>
        </div>
      </div>

      {/* New Admission Form */}
      <NewAdmissionSheet 
        open={isNewAdmissionOpen} 
        onOpenChange={setIsNewAdmissionOpen} 
        form={stayForm} 
        onUpdateForm={updateStayForm} 
        departments={departments} 
        doctors={doctors} 
        saving={savingStay} 
        error={stayError} 
        onSubmit={handleSaveStay} 
      />
    </div>
  );
}
