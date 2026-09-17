"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, AlertTriangle, BatteryWarning, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { InventoryRow } from "../types";

interface InventoryTabProps {
  inventory: InventoryRow[];
  search: string;
  setSearch: (search: string) => void;
  onRestock: (item: InventoryRow) => void;
  onEdit: (item: InventoryRow) => void;
}

export function InventoryTab({
  inventory,
  search,
  setSearch,
  onRestock,
  onEdit,
}: InventoryTabProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');

  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const filteredInventory = inventory.filter(item => {
    // Search
    const matchesSearch = !search || 
      item.name.toLowerCase().includes(search.toLowerCase()) || 
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    // Stock Filter
    if (stockFilter === 'low' && item.stock >= item.threshold) return false;
    if (stockFilter === 'out' && item.stock > 0) return false;

    return true;
  });

  const totalValue = inventory.reduce((sum, item) => sum + (item.stock * (item.unitPrice || 0)), 0);

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 shrink-0">
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm hover:border-blue-300 transition-colors cursor-pointer sm:p-4" onClick={() => setStockFilter('all')}>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 sm:text-xs">{t('total_skus')}</div>
          <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{inventory.length}</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 shadow-sm flex items-end justify-between hover:border-yellow-400 transition-colors cursor-pointer sm:p-4" onClick={() => setStockFilter('low')}>
          <div>
            <div className="text-[10px] font-semibold text-yellow-800 uppercase tracking-wider mb-1 sm:text-xs">{t('low_stock_alerts')}</div>
            <div className="text-2xl font-bold text-yellow-700 sm:text-3xl">{inventory.filter(i => i.stock < i.threshold && i.stock > 0).length}</div>
          </div>
          <BatteryWarning className="h-7 w-7 text-yellow-300 sm:h-8 sm:w-8" />
        </div>
        <div className="bg-red-50 p-3 rounded border border-red-200 shadow-sm flex items-end justify-between hover:border-red-400 transition-colors cursor-pointer sm:p-4" onClick={() => setStockFilter('out')}>
          <div>
            <div className="text-[10px] font-semibold text-red-800 uppercase tracking-wider mb-1 sm:text-xs">{t('out_of_stock')}</div>
            <div className="text-2xl font-bold text-red-700 sm:text-3xl">{inventory.filter(i => i.stock === 0).length}</div>
          </div>
          <AlertTriangle className="h-7 w-7 text-red-300 sm:h-8 sm:w-8" />
        </div>
        <div className="bg-blue-50 p-3 rounded border border-blue-200 shadow-sm flex items-end justify-between sm:p-4">
          <div>
            <div className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider mb-1 sm:text-xs">{t('inventory_value')}</div>
            <div className="text-lg font-bold text-blue-700 sm:text-xl">{totalValue.toLocaleString()} <span className="text-xs">XAF</span></div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="search"
              placeholder={t('search_inventory')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
            />
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-200/50 p-1 sm:flex sm:flex-wrap">
            <button onClick={() => setStockFilter("all")} className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold sm:px-3", stockFilter === "all" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('stock_filter_all')}</button>
            <button onClick={() => setStockFilter("low")} className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold sm:px-3", stockFilter === "low" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('stock_filter_low')}</button>
            <button onClick={() => setStockFilter("out")} className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold sm:px-3", stockFilter === "out" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('stock_filter_out')}</button>
          </div>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-3 py-2 sm:px-4">{tc('ipp')}</th>
                <th className="px-3 py-2 sm:px-4">{tc('name')}</th>
                <th className="px-3 py-2 sm:px-4">{t('category')}</th>
                <th className="px-3 py-2 text-right sm:px-4">{t('unit_price')}</th>
                <th className="px-3 py-2 text-right sm:px-4">{t('current_stock')}</th>
                <th className="px-3 py-2 text-right sm:px-4">{t('threshold')}</th>
                <th className="px-3 py-2 sm:px-4">{tc('status')}</th>
                <th className="px-3 py-2 text-right sm:px-4">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-mono text-slate-600 sm:px-4">{item.id.slice(0, 8)}</td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-[10px] text-slate-500">{item.manufacturer}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-600 sm:px-4">{item.category}</td>
                  <td className="px-3 py-3 text-right font-mono font-medium sm:px-4">
                    {item.unitPrice ? item.unitPrice.toLocaleString() : '—'} <span className="text-[10px] text-slate-400 ml-0.5">XAF</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-medium sm:px-4">
                    {item.stock} <span className="text-slate-400 text-[10px] ml-1">{item.unit}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-500 sm:px-4">
                    {item.threshold}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                      item.stock > item.threshold ? "bg-green-100 text-green-700" :
                        item.stock > 0 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                    )}>
                      {item.stock > item.threshold ? t('in_stock') : item.stock > 0 ? t('stock_filter_low') : t('out_of_stock_label')}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right space-x-2 sm:px-4">
                    <button className="text-blue-600 hover:underline font-medium text-[10px] sm:text-xs" onClick={() => onRestock(item)}>{t('restock')}</button>
                    <button className="text-slate-500 hover:text-slate-800 hover:underline font-medium text-[10px] sm:text-xs" onClick={() => onEdit(item)}>{tc('edit')}</button>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 text-xs">{tc('no_data')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
