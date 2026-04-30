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
      <div className="grid gap-4 md:grid-cols-4 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setStockFilter('all')}>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('total_skus')}</div>
          <div className="text-3xl font-bold text-slate-900">{inventory.length}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded border border-yellow-200 shadow-sm flex items-end justify-between hover:border-yellow-400 transition-colors cursor-pointer" onClick={() => setStockFilter('low')}>
          <div>
            <div className="text-xs font-semibold text-yellow-800 uppercase tracking-wider mb-1">{t('low_stock_alerts')}</div>
            <div className="text-3xl font-bold text-yellow-700">{inventory.filter(i => i.stock < i.threshold && i.stock > 0).length}</div>
          </div>
          <BatteryWarning className="h-8 w-8 text-yellow-300" />
        </div>
        <div className="bg-red-50 p-4 rounded border border-red-200 shadow-sm flex items-end justify-between hover:border-red-400 transition-colors cursor-pointer" onClick={() => setStockFilter('out')}>
          <div>
            <div className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">{t('out_of_stock')}</div>
            <div className="text-3xl font-bold text-red-700">{inventory.filter(i => i.stock === 0).length}</div>
          </div>
          <AlertTriangle className="h-8 w-8 text-red-300" />
        </div>
        <div className="bg-blue-50 p-4 rounded border border-blue-200 shadow-sm flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">{t('inventory_value')}</div>
            <div className="text-xl font-bold text-blue-700">{totalValue.toLocaleString()} <span className="text-xs">XAF</span></div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative w-96 flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="search"
              placeholder={t('search_inventory')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
            />
          </div>
          <div className="flex bg-slate-200/50 p-1 rounded-md ml-4">
            <button onClick={() => setStockFilter("all")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", stockFilter === "all" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('stock_filter_all')}</button>
            <button onClick={() => setStockFilter("low")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", stockFilter === "low" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('stock_filter_low')}</button>
            <button onClick={() => setStockFilter("out")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", stockFilter === "out" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('stock_filter_out')}</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{tc('ipp')}</th>
                <th className="px-4 py-2">{tc('name')}</th>
                <th className="px-4 py-2">{t('category')}</th>
                <th className="px-4 py-2 text-right">{t('unit_price')}</th>
                <th className="px-4 py-2 text-right">{t('current_stock')}</th>
                <th className="px-4 py-2 text-right">{t('threshold')}</th>
                <th className="px-4 py-2">{tc('status')}</th>
                <th className="px-4 py-2 text-right">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-600">{item.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-[10px] text-slate-500">{item.manufacturer}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.category}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {item.unitPrice ? item.unitPrice.toLocaleString() : '—'} <span className="text-[10px] text-slate-400 ml-0.5">XAF</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {item.stock} <span className="text-slate-400 text-[10px] ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500">
                    {item.threshold}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                      item.stock > item.threshold ? "bg-green-100 text-green-700" :
                        item.stock > 0 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                    )}>
                      {item.stock > item.threshold ? t('in_stock') : item.stock > 0 ? t('stock_filter_low') : t('out_of_stock_label')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button className="text-blue-600 hover:underline font-medium" onClick={() => onRestock(item)}>{t('restock')}</button>
                    <button className="text-slate-500 hover:text-slate-800 hover:underline font-medium" onClick={() => onEdit(item)}>{tc('edit')}</button>
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
