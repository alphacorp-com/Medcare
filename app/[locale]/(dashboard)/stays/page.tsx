"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";

import { StaysHeader } from "./_components/StaysHeader";
import { StaysFilterBar } from "./_components/StaysFilterBar";
import { StaysTable } from "./_components/StaysTable";
import { NewAdmissionSheet } from "./_components/NewAdmissionSheet";
import { useAdmissionsPage } from "./_hooks/useAdmissionsPage";

export default function AdmissionsPage() {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const hasModule = useAppStore((state) => state.hasModule);

  const [showFilters, setShowFilters] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const {
    stays, departments, doctors, beds, loading, error,
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

  return (
    <div className="flex flex-col h-full space-y-4">
      <StaysHeader
        onFilterToggle={() => setShowFilters((v) => !v)}
        onNewAdmission={openSheet}
      />

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <StaysFilterBar
          showFilters={showFilters}
          onFilterClose={() => setShowFilters(false)}
        />

        <StaysTable stays={stays} loading={loading} error={error} />

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <span>{stays.length} {t("stays_total")}</span>
          <div className="flex gap-4">
            <span className="text-blue-600 font-semibold cursor-pointer">
              {tc("view")} {tc("all")}
            </span>
            <span className="text-blue-600 font-semibold cursor-pointer">{tc("print")}</span>
          </div>
        </div>
      </div>

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
    </div>
  );
}
