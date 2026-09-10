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
    <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-xs text-slate-500">{t('description')}</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => onTabChange("prescriptions")}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2",
              tab === "prescriptions" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <ClipboardList className="h-4 w-4" /> {t('queue_tab')}
          </button>
          <button
            onClick={() => onTabChange("inventory")}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2",
              tab === "inventory" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Package className="h-4 w-4" /> {t('inventory_tab')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 text-xs text-slate-700 border-slate-200"
          onClick={tab === "prescriptions" ? onExportRx : onExportInventory}
        >
          <FileDown className="mr-2 h-4 w-4" /> 
          {tab === "prescriptions" ? t('export_prescriptions') : t('export_inventory')}
        </Button>
        {tab === "inventory" && (
          <Button className="h-9 text-xs bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={onAddMedication}>
            <Plus className="mr-2 h-4 w-4" /> {t('add_medication')}
          </Button>
        )}
      </div>
    </div>
  );
}
