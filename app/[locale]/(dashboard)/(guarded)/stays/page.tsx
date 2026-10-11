"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import StandardMobileTemplate from "@/components/layout/mobile/StandardMobileTemplate";
import { useIsMobile } from "@/hooks/use-mobile";

import { StaysHeader } from "./_components/StaysHeader";
import { StaysFilterBar } from "./_components/StaysFilterBar";
import { StaysTable } from "./_components/StaysTable";
import { NewAdmissionSheet } from "./_components/NewAdmissionSheet";
import { useAdmissionsPage } from "./_hooks/useAdmissionsPage";
import { PaginationBar } from "@/components/shared/pagination-bar";

export default function AdmissionsPage() {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const hasModule = useAppStore((state) => state.hasModule);
  const isMobile = useIsMobile();

  const [showFilters, setShowFilters] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const {
    stays, departments, doctors, beds, loading, error,
    view, setView,
    total, page, setPage, pageSize, setPageSize,
    searchInput, setSearchInput, filters, setFilters,
    stayForm, updateStayForm, resetForm,
    savingStay, stayError,
    handleSaveStay,
  } = useAdmissionsPage();

  // ── Module guard ──────────────────────────────────────────────────────────

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openSheet = () => {
    resetForm();
    setIsSheetOpen(true);
  };

  const handleSubmit = async () => {
    const success = await handleSaveStay();
    if (success) setIsSheetOpen(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const mobile = (
    <StandardMobileTemplate
      title={t("title")}
      subtitle={t("description")}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => setShowFilters((v) => !v)}>
            {tc("filter")}
          </Button>
          <Button size="sm" className="h-8 text-[11px] bg-blue-600 hover:bg-blue-700" onClick={openSheet}>
            {t("new_admission")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <StaysFilterBar
          showFilters={showFilters}
          onFilterClose={() => setShowFilters(false)}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          filters={filters}
          onApplyFilters={setFilters}
        />
        <div className="overflow-x-auto">
          <div className="sm:min-w-[640px]">
            <StaysTable stays={stays} loading={loading} error={error} view={view} />
          </div>
        </div>
        <PaginationBar className="rounded-xl border" page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </StandardMobileTemplate>
  );

  const desktop = (
    <div className="flex flex-col h-full space-y-4">
      <StaysHeader
        onFilterToggle={() => setShowFilters((v) => !v)}
        onNewAdmission={openSheet}
        view={view}
        onViewChange={setView}
      />

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <StaysFilterBar
          showFilters={showFilters}
          onFilterClose={() => setShowFilters(false)}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          filters={filters}
          onApplyFilters={setFilters}
        />

        <div className="flex-1 overflow-auto">
          <StaysTable stays={stays} loading={loading} error={error} view={view} />
        </div>

        <PaginationBar className="shrink-0" page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );

  // The sheet lives outside both layouts so the mobile "new admission" button can open it too.
  return (
    <>
      {isMobile ? mobile : desktop}

      <NewAdmissionSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        form={stayForm}
        onUpdateForm={updateStayForm}
        departments={departments}
        doctors={doctors}
        beds={beds}
        saving={savingStay}
        error={stayError}
        onSubmit={handleSubmit}
      />
    </>
  );
}
