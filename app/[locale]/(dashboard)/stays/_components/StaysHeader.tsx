"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Bed, Filter } from "lucide-react";

interface StaysHeaderProps {
  onFilterToggle: () => void;
  onNewAdmission: () => void;
}

export function StaysHeader({ onFilterToggle, onNewAdmission }: StaysHeaderProps) {
  const t = useTranslations("admissions");
  const tp = useTranslations("patients");

  return (
    <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
        <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
      </div>
      <div className="flex gap-2">
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
