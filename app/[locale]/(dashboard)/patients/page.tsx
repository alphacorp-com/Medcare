"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useRouter } from "@/i18n/routing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";

// Internal Components
import { PatientsHeader } from "./_components/PatientsHeader";
import { PatientsFilterBar } from "./_components/PatientsFilterBar";
import { PatientsTable } from "./_components/PatientsTable";
import { NewPatientSheet } from "./_components/NewPatientSheet";

// Types & Helpers
import { 
  PatientRow, 
  NewPatientForm, 
  EMPTY_FORM, 
  ageFromBirthDate 
} from "./types";

export default function PatientsPage() {
  const hasModule = useAppStore((state) => state.hasModule);
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const tDocs = useTranslations('documents');
  
  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<any>(null);

  // Data State
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "deceased">("active");
  const [pendingStatus, setPendingStatus] = useState<"active" | "deceased">("active");

  // Form State
  const [form, setForm] = useState<NewPatientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounce the search input
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/v1/patients", window.location.origin);
      if (searchQuery) url.searchParams.set("q", searchQuery);
      url.searchParams.set("status", statusFilter);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load");
      setPatients(json.data as PatientRow[]);
      setTotal(json.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error_load'));
      setPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, t]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleExportPDF = () => {
    const data = {
      title: tDocs('patient_list'),
      department: t('title'),
      date: format(new Date(), "yyyy-MM-dd"),
      patients: patients.map(p => ({
        ipp: p.ipp,
        name: `${p.lastName} ${p.firstName}`,
        gender: p.gender,
        age: `${ageFromBirthDate(p.birthDate)}`,
        status: p.isDeceased ? t('status_deceased') : tc('status_active')
      }))
    };
    setPdfData(data);
    setIsPreviewOpen(true);
  };

  const applyFilters = () => {
    setStatusFilter(pendingStatus);
  };

  const clearFilters = () => {
    setPendingStatus("active");
    setStatusFilter("active");
    setShowFilters(false);
  };

  const updateForm = <K extends keyof NewPatientForm>(key: K, value: NewPatientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = useMemo(
    () => !!(form.firstName && form.lastName && form.birthDate && form.gender),
    [form],
  );

  const handleSave = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        birthDate: form.birthDate,
        gender: form.gender,
        nss: form.nss || null,
        bloodGroup: form.bloodGroup || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        emergencyContact:
          form.emergencyName || form.emergencyPhone
            ? {
              name: form.emergencyName,
              relation: form.emergencyRelation,
              phone: form.emergencyPhone,
            }
            : {},
      };
      const res = await fetch("/api/v1/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      setIsNewPatientOpen(false);
      setForm(EMPTY_FORM);
      await fetchPatients();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('error_save_patient'));
    } finally {
      setSaving(false);
    }
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!hasModule('MODULE_CORE_PATIENT')) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tc('restricted_access')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('module_desc')}</p>
          <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
            {tc('contact_admin')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Section */}
      <PatientsHeader 
        onExport={handleExportPDF} 
        onFilterToggle={() => setShowFilters(!showFilters)} 
        onNewPatient={() => setIsNewPatientOpen(true)} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <PatientsFilterBar 
          searchInput={searchInput} 
          onSearchChange={setSearchInput} 
          showFilters={showFilters} 
          statusFilter={pendingStatus} 
          onStatusFilterChange={setPendingStatus} 
          onApplyFilters={applyFilters} 
          onClearFilters={clearFilters} 
        />

        <PatientsTable 
          patients={patients} 
          loading={loading} 
          error={error} 
        />

        {/* Footer Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <span>{t('showing_total', { count: total })}</span>
        </div>
      </div>

      {/* Side Sheet Form */}
      <NewPatientSheet 
        open={isNewPatientOpen} 
        onOpenChange={setIsNewPatientOpen} 
        form={form} 
        onUpdateForm={updateForm} 
        saving={saving} 
        error={saveError} 
        onSubmit={handleSave} 
        canSubmit={canSubmit} 
      />

      {/* PDF Export Preview Modal */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        templateId="patient_lists"
        data={pdfData}
        facility={{ name: tc('hospital_name') }}
        settings={{ watermark: true }}
      />
    </div>
  );
}
