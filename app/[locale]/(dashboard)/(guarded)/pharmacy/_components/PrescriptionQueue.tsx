"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Search, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PrescriptionRow } from "../types";

interface PrescriptionQueueProps {
  prescriptions: PrescriptionRow[];
  filter: string;
  setFilter: (filter: string) => void;
  search: string;
  setSearch: (search: string) => void;
  onSelectRx: (rx: PrescriptionRow) => void;
  onAction: (rx: PrescriptionRow) => void;
}

export function PrescriptionQueue({
  prescriptions,
  filter,
  setFilter,
  search,
  setSearch,
  onSelectRx,
  onAction,
}: PrescriptionQueueProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');

  const filteredPrescriptions = prescriptions.filter(rx => {
    // Status Filter
    if (filter !== "All") {
      if (filter === "Pending Queue" && rx.status !== "Pending Queue") return false;
      if (filter === "Validated" && rx.status !== "Validated") return false;
      if (filter === "Dispensed" && rx.status !== "Dispensed") return false;
    }

    // Search
    if (search) {
      const s = search.toLowerCase();
      const matches = 
        rx.patientName.toLowerCase().includes(s) || 
        rx.id.toLowerCase().includes(s) ||
        rx.prescriber.toLowerCase().includes(s) ||
        rx.ipp.toLowerCase().includes(s);
      if (!matches) return false;
    }
    
    return true;
  });

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="grid gap-3 sm:grid-cols-3 shrink-0">
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer sm:p-4" onClick={() => setFilter("Pending Queue")}>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 sm:text-xs">{t('to_validate')}</div>
            <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{prescriptions.filter(r => r.status === 'Pending Queue').length}</div>
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer sm:p-4" onClick={() => setFilter("Validated")}>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 sm:text-xs">{t('to_dispense')}</div>
            <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{prescriptions.filter(r => r.status === 'Validated').length}</div>
          </div>
        </div>
        <div className="bg-red-50 p-3 rounded border border-red-200 shadow-sm flex items-end justify-between hover:border-red-400 transition-colors cursor-pointer sm:p-4">
          <div>
            <div className="text-[10px] font-semibold text-red-800 uppercase tracking-wider mb-1 sm:text-xs">{t('interaction_alerts')}</div>
            <div className="text-2xl font-bold text-red-700 sm:text-3xl">{prescriptions.filter(r => r.alert).length}</div>
          </div>
          <AlertTriangle className="h-7 w-7 text-red-200 sm:h-8 sm:w-8" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="search"
              placeholder={t('search_rx')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-200/50 p-1 sm:flex sm:flex-wrap">
            <button onClick={() => setFilter("All")} className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold sm:px-3", filter === "All" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{tc('all')}</button>
            <button onClick={() => setFilter("Pending Queue")} className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold sm:px-3", filter === "Pending Queue" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('to_validate')}</button>
            <button onClick={() => setFilter("Validated")} className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold sm:px-3", filter === "Validated" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('to_dispense')}</button>
            <button onClick={() => setFilter("Dispensed")} className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold sm:px-3", filter === "Dispensed" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('dispensed_tab')}</button>
          </div>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-3 py-2 sm:px-4">{t('rx_id')}</th>
                <th className="px-3 py-2 sm:px-4">{t('patient')}</th>
                <th className="px-3 py-2 sm:px-4">{t('prescriber')}</th>
                <th className="px-3 py-2 sm:px-4">{t('items')}</th>
                <th className="px-3 py-2 sm:px-4">{t('prescribed_at')}</th>
                <th className="px-3 py-2 sm:px-4">{tc('status')}</th>
                <th className="px-3 py-2 text-right sm:px-4">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredPrescriptions.map((rx) => (
                <tr key={rx.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => onSelectRx(rx)}>
                  <td className="px-3 py-2 font-mono text-slate-600 sm:px-4">{rx.id.slice(0, 8)}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 sm:px-4">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[12rem]">{rx.patientName}</span>
                      <span className="text-[10px] font-mono text-slate-400">({rx.ipp})</span>
                      {rx.alert && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 sm:px-4">{rx.prescriber}</td>
                  <td className="px-3 py-2 sm:px-4">{rx.items} {t('medications')}</td>
                  <td className="px-3 py-2 text-slate-500 sm:px-4">{format(new Date(rx.date), "MMM dd, yyyy HH:mm")}</td>
                  <td className="px-3 py-2 sm:px-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                      rx.status === 'Pending Queue' ? "bg-yellow-100 text-yellow-700" :
                        rx.status === 'Validated' ? "bg-blue-100 text-blue-700" :
                          "bg-green-100 text-green-700"
                    )}>
                      {rx.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right sm:px-4">
                    <button
                      className={cn(
                        "font-semibold px-3 py-1 rounded text-[10px] sm:text-xs",
                        rx.status === 'Pending Queue' ? "bg-blue-600 text-white hover:bg-blue-700" :
                          rx.status === 'Validated' ? "bg-green-600 text-white hover:bg-green-700" :
                            "text-blue-600 hover:bg-blue-50"
                      )}
                      onClick={(e) => { e.stopPropagation(); onAction(rx); }}
                    >
                      {rx.status === 'Pending Queue' ? t('validate') : rx.status === 'Validated' ? t('dispense') : tc('view')}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPrescriptions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">{tc('no_data')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
