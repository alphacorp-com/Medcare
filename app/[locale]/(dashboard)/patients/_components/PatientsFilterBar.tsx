"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PatientsFilterBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  showFilters: boolean;
  statusFilter: "active" | "deceased";
  onStatusFilterChange: (value: "active" | "deceased") => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

export function PatientsFilterBar({
  searchInput,
  onSearchChange,
  showFilters,
  statusFilter,
  onStatusFilterChange,
  onApplyFilters,
  onClearFilters,
}: PatientsFilterBarProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="flex items-center w-full">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('search_placeholder')}
            className="h-11 w-full rounded-xl border-slate-200 bg-white pl-9 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {showFilters && (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{tc('status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as "active" | "deceased")}
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="active">{tc('status_active')}</option>
              <option value="deceased">{t('status_deceased')}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="h-9 flex-1 rounded-xl text-xs" onClick={onApplyFilters}>{t('apply_filters')}</Button>
            <Button size="sm" variant="ghost" className="h-9 rounded-xl text-xs text-slate-500" onClick={onClearFilters}>{t('clear')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
