"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface StaysFilterBarProps {
  showFilters: boolean;
  onFilterClose: () => void;
}

export function StaysFilterBar({ showFilters, onFilterClose }: StaysFilterBarProps) {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const tp = useTranslations("patients");

  return (
    <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="relative w-96">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="search"
            placeholder={tc("search")}
            className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-normal italic">
            Updated 1m ago
          </span>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 pt-2 mt-1 border-t border-slate-200/60 transition-all animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {tc("status")}:
            </label>
            <select className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700">
              <option>{tc("all")}</option>
              <option value="in_progress">In Progress</option>
              <option value="pre_admission">Pre-Admission</option>
              <option value="discharged">Discharged</option>
              <option value="transferred">Transferred</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              {t("arrival_mode")}:
            </label>
            <select className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700">
              <option>{tc("all")}</option>
              <option value="emergency">Emergency</option>
              <option value="scheduled">Scheduled</option>
              <option value="day_care">Day Care</option>
              <option value="outpatient">Outpatient</option>
            </select>
          </div>
          <Button size="sm" variant="secondary" className="h-7 text-xs ml-auto">
            {tp("apply_filters")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-500"
            onClick={onFilterClose}
          >
            {tp("clear")}
          </Button>
        </div>
      )}
    </div>
  );
}
