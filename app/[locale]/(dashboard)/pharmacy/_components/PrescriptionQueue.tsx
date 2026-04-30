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
    if (filter !== "All" && rx.status !== filter) return false;
    if (search && !rx.patientName.toLowerCase().includes(search.toLowerCase()) && !rx.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="grid gap-4 md:grid-cols-3 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Pending Queue")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('to_validate')}</div>
            <div className="text-3xl font-bold text-slate-900">{prescriptions.filter(r => r.status === 'Pending Queue').length}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Validated")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('to_dispense')}</div>
            <div className="text-3xl font-bold text-slate-900">{prescriptions.filter(r => r.status === 'Validated').length}</div>
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded border border-red-200 shadow-sm flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">{t('interaction_alerts')}</div>
            <div className="text-3xl font-bold text-red-700">{prescriptions.filter(r => r.alert).length}</div>
          </div>
          <AlertTriangle className="h-8 w-8 text-red-200" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative w-96 flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="search"
              placeholder={t('search_rx')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
            />
          </div>
          <div className="flex bg-slate-200/50 p-1 rounded-md ml-4">
            <button onClick={() => setFilter("All")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "All" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{tc('all')}</button>
            <button onClick={() => setFilter("Pending Queue")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "Pending Queue" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('to_validate')}</button>
            <button onClick={() => setFilter("Validated")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "Validated" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('to_dispense')}</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{t('rx_id')}</th>
                <th className="px-4 py-2">{t('patient')}</th>
                <th className="px-4 py-2">{t('prescriber')}</th>
                <th className="px-4 py-2">{t('items')}</th>
                <th className="px-4 py-2">{t('prescribed_at')}</th>
                <th className="px-4 py-2">{tc('status')}</th>
                <th className="px-4 py-2 text-right">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredPrescriptions.map((rx) => (
                <tr key={rx.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => onSelectRx(rx)}>
                  <td className="px-4 py-2 font-mono text-slate-600">{rx.id}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {rx.patientName}
                      <span className="text-[10px] font-mono text-slate-400">({rx.ipp})</span>
                      {rx.alert && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{rx.prescriber}</td>
                  <td className="px-4 py-2">{rx.items} {t('medications')}</td>
                  <td className="px-4 py-2 text-slate-500">{format(new Date(rx.date), "MMM dd, yyyy HH:mm")}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                      rx.status === 'Pending Queue' ? "bg-yellow-100 text-yellow-700" :
                        rx.status === 'Validated' ? "bg-blue-100 text-blue-700" :
                          "bg-green-100 text-green-700"
                    )}>
                      {rx.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className={cn(
                        "font-semibold px-3 py-1 rounded",
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
