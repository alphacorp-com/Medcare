"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { InventoryRow, MedForm, StorageLocationOption, SupplierOption } from "../types";

function useStorageAndSuppliers() {
  const [locations, setLocations] = useState<StorageLocationOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [locRes, supRes] = await Promise.all([
          fetch("/api/v1/settings/storage-locations"),
          fetch("/api/v1/settings/suppliers"),
        ]);
        if (locRes.ok) setLocations(await locRes.json());
        if (supRes.ok) setSuppliers(await supRes.json());
      } catch (e) { }
    })();
  }, []);

  return { locations, suppliers };
}

interface AddMedicationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: MedForm;
  onUpdateForm: (form: MedForm) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
}

export function AddMedicationSheet({
  open,
  onOpenChange,
  form,
  onUpdateForm,
  saving,
  onSubmit,
}: AddMedicationSheetProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');
  const { locations, suppliers } = useStorageAndSuppliers();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('add_medication')}</SheetTitle>
          <SheetDescription className="text-xs">
            {t('add_medication_desc')}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('name')}</label>
            <Input
              value={form.name}
              onChange={(e) => onUpdateForm({ ...form, name: e.target.value })}
              placeholder={t('med_name_placeholder')}
              className="h-8 text-xs bg-white border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('manufacturer')}</label>
            <Input
              value={form.manufacturer}
              onChange={(e) => onUpdateForm({ ...form, manufacturer: e.target.value })}
              className="h-8 text-xs bg-white border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('category')}</label>
            <Input
              value={form.category}
              onChange={(e) => onUpdateForm({ ...form, category: e.target.value })}
              className="h-8 text-xs bg-white border-slate-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('initial_stock')}</label>
              <Input
                type="number"
                value={form.stock}
                onChange={(e) => onUpdateForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs bg-white border-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('threshold')}</label>
              <Input
                type="number"
                value={form.threshold}
                onChange={(e) => onUpdateForm({ ...form, threshold: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs bg-white border-slate-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('unit_placeholder')}</label>
              <Input
                value={form.unit}
                onChange={(e) => onUpdateForm({ ...form, unit: e.target.value })}
                className="h-8 text-xs bg-white border-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('unit_price')} (XAF)</label>
              <Input
                type="number"
                value={form.unitPrice || ''}
                onChange={(e) => onUpdateForm({ ...form, unitPrice: parseFloat(e.target.value) || null })}
                className="h-8 text-xs bg-white border-slate-200 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('storage_location')}</label>
              <select
                value={form.storageLocationId ?? ''}
                onChange={(e) => onUpdateForm({ ...form, storageLocationId: e.target.value || null })}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                <option value="">—</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('supplier')}</label>
              <select
                value={form.supplierId ?? ''}
                onChange={(e) => onUpdateForm({ ...form, supplierId: e.target.value || null })}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                <option value="">—</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" disabled={saving || !form.name} onClick={onSubmit}>
            {saving ? t('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface EditMedicationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: InventoryRow | null;
  onUpdateForm: (form: InventoryRow) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
}

export function EditMedicationSheet({
  open,
  onOpenChange,
  form,
  onUpdateForm,
  saving,
  onSubmit,
}: EditMedicationSheetProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');
  const { locations, suppliers } = useStorageAndSuppliers();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('edit_medication')}</SheetTitle>
          <SheetDescription className="text-xs">
            {t('edit_medication_desc')}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {form && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('name')}</label>
                <Input
                  value={form.name}
                  onChange={(e) => onUpdateForm({ ...form, name: e.target.value })}
                  className="h-8 text-xs bg-white border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('manufacturer')}</label>
                <Input
                  value={form.manufacturer}
                  onChange={(e) => onUpdateForm({ ...form, manufacturer: e.target.value })}
                  className="h-8 text-xs bg-white border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('category')}</label>
                <Input
                  value={form.category}
                  onChange={(e) => onUpdateForm({ ...form, category: e.target.value })}
                  className="h-8 text-xs bg-white border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('current_stock')}</label>
                  <Input
                    type="number"
                    value={form.stock}
                    onChange={(e) => onUpdateForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs bg-white border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('threshold')}</label>
                  <Input
                    type="number"
                    value={form.threshold}
                    onChange={(e) => onUpdateForm({ ...form, threshold: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs bg-white border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('unit_placeholder')}</label>
                  <Input
                    value={form.unit}
                    onChange={(e) => onUpdateForm({ ...form, unit: e.target.value })}
                    className="h-8 text-xs bg-white border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('unit_price')} (XAF)</label>
                  <Input
                    type="number"
                    value={form.unitPrice || ''}
                    onChange={(e) => onUpdateForm({ ...form, unitPrice: parseFloat(e.target.value) || null })}
                    className="h-8 text-xs bg-white border-slate-200 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('storage_location')}</label>
                  <select
                    value={form.storageLocationId ?? ''}
                    onChange={(e) => onUpdateForm({ ...form, storageLocationId: e.target.value || null })}
                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                  >
                    <option value="">—</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('supplier')}</label>
                  <select
                    value={form.supplierId ?? ''}
                    onChange={(e) => onUpdateForm({ ...form, supplierId: e.target.value || null })}
                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                  >
                    <option value="">—</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" disabled={saving || !form?.name} onClick={onSubmit}>
            {saving ? t('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface RestockSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  med: InventoryRow | null;
  amount: number;
  onAmountChange: (amount: number) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
}

export function RestockSheet({
  open,
  onOpenChange,
  med,
  amount,
  onAmountChange,
  saving,
  onSubmit,
}: RestockSheetProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-sm w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t('restock')}</SheetTitle>
          <SheetDescription className="text-xs">
            {t('restock_desc')} {med?.name}.
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="bg-slate-100 p-3 rounded border border-slate-200 text-xs flex justify-between">
            <span className="font-bold text-slate-500 uppercase">{t('current_stock')}</span>
            <span className="font-mono font-bold text-slate-900">{med?.stock} {med?.unit}</span>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('quantity_to_add')}</label>
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => onAmountChange(parseInt(e.target.value) || 0)}
              className="h-10 text-lg bg-white border-slate-200 font-mono"
            />
          </div>
          {amount > 0 && med && (
             <div className="bg-green-50 p-3 rounded border border-green-200 text-xs flex justify-between">
               <span className="font-bold text-green-700 uppercase">{t('new_total')}</span>
               <span className="font-mono font-bold text-green-800">{(med.stock) + amount} {med.unit}</span>
             </div>
          )}
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc('cancel')}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" disabled={saving || amount <= 0} onClick={onSubmit}>
            {saving ? t('saving') : tc('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
