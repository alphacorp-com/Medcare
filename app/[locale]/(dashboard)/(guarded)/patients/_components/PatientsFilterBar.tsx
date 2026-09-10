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
    <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
      <div className="flex items-center">
        <div className="relative w-96">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('search_placeholder')}
            className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
          />
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 pt-2 mt-1 border-t border-slate-200/60 transition-all animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('status')}:</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as "active" | "deceased")}
              className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700"
            >
              <option value="active">{tc('status_active')}</option>
              <option value="deceased">{t('status_deceased')}</option>
            </select>
          </div>
          <Button size="sm" variant="secondary" className="h-7 text-xs ml-auto" onClick={onApplyFilters}>{t('apply_filters')}</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={onClearFilters}>{t('clear')}</Button>
        </div>
      )}
    </div>
  );
}
