"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Bed, Filter, Siren } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaysHeaderProps {
  onFilterToggle: () => void;
  onNewAdmission: () => void;
  view: "all" | "triage";
  onViewChange: (view: "all" | "triage") => void;
}

export function StaysHeader({ onFilterToggle, onNewAdmission, view, onViewChange }: StaysHeaderProps) {
  const t = useTranslations("admissions");
  const tp = useTranslations("patients");

  return (
    <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
        <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex bg-slate-200/50 p-1 rounded-md">
          <button
            onClick={() => onViewChange("all")}
            className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", view === "all" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}
          >
            {t("view_all_stays")}
          </button>
          <button
            onClick={() => onViewChange("triage")}
            className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1", view === "triage" ? "bg-white shadow-sm text-red-600" : "text-slate-500 hover:text-slate-700")}
          >
            <Siren className="h-3 w-3" />
            {t("view_triage")}
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 text-slate-700"
          onClick={onFilterToggle}
        >
          <Filter className="mr-2 h-3 w-3" />
          {tp("advanced_filters")}
        </Button>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
          onClick={onNewAdmission}
        >
          <Bed className="mr-2 h-3 w-3" />
          {t("new_admission")}
        </Button>
      </div>
    </div>
  );
}
