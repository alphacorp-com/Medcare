"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, Package, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PharmacyHeaderProps {
  tab: "prescriptions" | "inventory";
  onTabChange: (tab: "prescriptions" | "inventory") => void;
  onAddMedication: () => void;
  onExportRx: () => void;
  onExportInventory: () => void;
}

export function PharmacyHeader({ 
  tab, 
  onTabChange, 
  onAddMedication,
  onExportRx,
  onExportInventory
}: PharmacyHeaderProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');

  return (
    <div className="bg-white border-b border-slate-200 px-3 py-3 sm:px-4 shrink-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-xs text-slate-500">{t('description')}</p>
        </div>

        <div className="w-full lg:w-auto">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => onTabChange("prescriptions")}
              className={cn(
                "rounded-md px-2 py-2 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 sm:text-xs",
                tab === "prescriptions" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="truncate">{t('queue_tab')}</span>
            </button>
            <button
              onClick={() => onTabChange("inventory")}
              className={cn(
                "rounded-md px-2 py-2 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 sm:text-xs",
                tab === "inventory" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="truncate">{t('inventory_tab')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 w-full text-[11px] text-slate-700 border-slate-200 sm:w-auto"
          onClick={tab === "prescriptions" ? onExportRx : onExportInventory}
        >
          <FileDown className="mr-2 h-4 w-4" /> 
          {tab === "prescriptions" ? t('export_prescriptions') : t('export_inventory')}
        </Button>
        {tab === "inventory" && (
          <Button className="h-9 w-full text-[11px] bg-blue-600 hover:bg-blue-700 shadow-sm sm:w-auto" onClick={onAddMedication}>
            <Plus className="mr-2 h-4 w-4" /> {t('add_medication')}
          </Button>
        )}
      </div>
    </div>
  );
}
