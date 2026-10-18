"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import { usePdfBranding } from "@/components/templates/usePdfBranding";
import type { PatientListData } from "@/components/templates/PatientListTemplate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { DEFAULT_PAGE_SIZE, PaginationBar } from "@/components/shared/pagination-bar";

// Internal Components
import { PatientsHeader } from "./_components/PatientsHeader";
import { PatientsFilterBar } from "./_components/PatientsFilterBar";
import { PatientsTable } from "./_components/PatientsTable";
import StandardMobileTemplate from "@/components/layout/mobile/StandardMobileTemplate";
import { NewPatientSheet } from "./_components/NewPatientSheet";
import { useIsMobile } from "@/hooks/use-mobile";

// Types & Helpers
import {
  PatientRow,
  NewPatientForm,
  DuplicateMatch,
  EMPTY_FORM,
  ageFromBirthDate,
} from "./types";

export default function PatientsPage() {
  const hasModule = useAppStore((state) => state.hasModule);
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const tDocs = useTranslations('documents');
  const { facility: pdfFacility, settings: pdfSettings } = usePdfBranding();

  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<PatientListData | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "deceased">("active");
  const [pendingStatus, setPendingStatus] = useState<"active" | "deceased">("active");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NewPatientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  // Debounce the search input; a new search starts back on the first page.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/v1/patients", window.location.origin);
      if (searchQuery) url.searchParams.set("q", searchQuery);
      url.searchParams.set("status", statusFilter);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(pageSize));
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load");
      setPatients(json.data as PatientRow[]);
      setTotal(json.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_load"));
      setPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, page, pageSize, t]);

  useEffect(() => {
    (async () => {
      await fetchPatients();
    })();
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
    setPage(1);
  };

  const clearFilters = () => {
    setPendingStatus("active");
    setStatusFilter("active");
    setPage(1);
    setShowFilters(false);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const updateForm = <K extends keyof NewPatientForm>(key: K, value: NewPatientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = useMemo(
    () => !!(form.firstName && form.lastName && form.birthDate && form.gender),
    [form],
  );

  const doCreatePatient = async () => {
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
        allergies: form.allergies,
        chronicConditions: form.chronicConditions,
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
      setShowDuplicateDialog(false);
      setDuplicateMatches([]);
      // The list is newest-first: show the first page, unfiltered, with the new patient on top.
      setLastCreatedId(json.data?.id ?? null);
      setSearchInput("");
      setSearchQuery("");
      setPendingStatus("active");
      setStatusFilter("active");
      if (page === 1) await fetchPatients();
      else setPage(1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('error_save_patient'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const url = new URL("/api/v1/patients/check-duplicate", window.location.origin);
      url.searchParams.set("firstName", form.firstName);
      url.searchParams.set("lastName", form.lastName);
      url.searchParams.set("birthDate", form.birthDate);
      if (form.nss) url.searchParams.set("nss", form.nss);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success && json.matches?.length > 0) {
        setDuplicateMatches(json.matches);
        setShowDuplicateDialog(true);
        setSaving(false);
        return;
      }
    } catch {
      // If the duplicate check itself fails, don't block patient creation on it.
    }
    await doCreatePatient();
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  const isMobile = useIsMobile();

  if (!hasModule("MODULE_CORE_PATIENT")) {
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

  const desktop = (
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

        <div className="flex-1 overflow-auto">
          <PatientsTable patients={patients} loading={loading} error={error} highlightId={lastCreatedId} />
        </div>

        <PaginationBar
          className="shrink-0"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
        />
      </div>

      {/* PDF Export Preview Modal */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        templateId="patient_lists"
        data={pdfData}
        facility={pdfFacility}
        settings={pdfSettings}
      />

      {/* Duplicate Patient Warning */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              {t("duplicate_found_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600">{t("duplicate_found_desc")}</p>
          <div className="space-y-2">
            {duplicateMatches.map((m) => (
              <div key={m.id} className="flex items-center justify-between border border-slate-200 rounded p-2 text-xs">
                <div>
                  <div className="font-semibold text-slate-800">{m.firstName} {m.lastName}</div>
                  <div className="text-slate-500 font-mono">{m.ipp} — {format(new Date(m.birthDate), "MMM d, yyyy")}</div>
                </div>
                <Link href={`/patients/${m.id}`} className="text-blue-600 hover:underline font-medium">
                  {t("view_existing")}
                </Link>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)} disabled={saving}>{tc("cancel")}</Button>
            <Button className="bg-amber-600 text-white hover:bg-amber-700" onClick={doCreatePatient} disabled={saving}>
              {t("create_anyway")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const mobile = (
    <StandardMobileTemplate
      title={t("title")}
      subtitle={t("subtitle")}
      actions={<PatientsHeader onExport={handleExportPDF} onFilterToggle={() => setShowFilters(!showFilters)} onNewPatient={() => setIsNewPatientOpen(true)} />}
    >
      <PatientsFilterBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        showFilters={showFilters}
        statusFilter={pendingStatus}
        onStatusFilterChange={setPendingStatus}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
      />

      <div className="mt-3">
        <PatientsTable patients={patients} loading={loading} error={error} highlightId={lastCreatedId} />
      </div>

      <PaginationBar
        className="mt-3 rounded-xl border"
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={changePageSize}
      />
    </StandardMobileTemplate>
  );

  return (
    <>
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

      {isMobile ? mobile : desktop}
    </>
  );
}
