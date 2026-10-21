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
import { RMA3_STOCK_CATEGORIES } from "@/lib/stock/input";
import { InventoryRow, MedForm, StorageLocationOption, SupplierOption } from "../types";

type AntigenOption = { id: string; code: string; nameFr: string };

// Reference lists of the article forms (and of the receipt sheet's supplier list).
export function useInventoryReferences() {
  const [locations, setLocations] = useState<StorageLocationOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [antigens, setAntigens] = useState<AntigenOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [locRes, supRes, antRes] = await Promise.all([
          fetch("/api/v1/settings/storage-locations"),
          fetch("/api/v1/settings/suppliers"),
          fetch("/api/v1/settings/reference-data/vaccine_antigen"),
        ]);
        if (locRes.ok) setLocations(await locRes.json());
        if (supRes.ok) setSuppliers(await supRes.json());
        if (antRes.ok) {
          const json = await antRes.json();
          if (Array.isArray(json)) setAntigens(json);
        }
      } catch {
        // The selects simply stay empty; the server validates every reference anyway.
      }
    })();
  }, []);

  return { locations, suppliers, antigens };
}

const fieldClass = "h-8 text-xs bg-white border-slate-200";
const selectClass =
  "flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-bold text-slate-500 uppercase">{children}</label>;
}

// The article's settings, shared by the creation and edit sheets.
function ItemFields<F extends MedForm>({ form, onUpdateForm }: { form: F; onUpdateForm: (form: F) => void }) {
  const t = useTranslations("pharmacy");
  const ts = useTranslations("stock");
  const tc = useTranslations("common");
  const { locations, suppliers, antigens } = useInventoryReferences();

  return (
    <>
      <div className="space-y-1">
        <Label>{tc("name")}</Label>
        <Input value={form.name} onChange={(e) => onUpdateForm({ ...form, name: e.target.value })} placeholder={t("med_name_placeholder")} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label>{t("manufacturer")}</Label>
        <Input value={form.manufacturer ?? ""} onChange={(e) => onUpdateForm({ ...form, manufacturer: e.target.value })} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label>{t("category")}</Label>
        <Input value={form.category ?? ""} onChange={(e) => onUpdateForm({ ...form, category: e.target.value })} className={fieldClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>{t("threshold")}</Label>
          <Input type="number" min={0} value={form.threshold} onChange={(e) => onUpdateForm({ ...form, threshold: parseInt(e.target.value) || 0 })} className={fieldClass} />
        </div>
        <div className="space-y-1">
          <Label>{t("unit_placeholder")}</Label>
          <Input value={form.unit ?? ""} onChange={(e) => onUpdateForm({ ...form, unit: e.target.value })} className={fieldClass} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>{t("unit_price")} (XAF)</Label>
        <Input type="number" min={0} value={form.unitPrice ?? ""} onChange={(e) => onUpdateForm({ ...form, unitPrice: parseFloat(e.target.value) || null })} className={`${fieldClass} font-mono`} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>{t("storage_location")}</Label>
          <select value={form.storageLocationId ?? ""} onChange={(e) => onUpdateForm({ ...form, storageLocationId: e.target.value || null })} className={selectClass}>
            <option value="">—</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>{t("supplier")}</Label>
          <select value={form.supplierId ?? ""} onChange={(e) => onUpdateForm({ ...form, supplierId: e.target.value || null })} className={selectClass}>
            <option value="">—</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>{sup.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>{ts("rma3_category")}</Label>
          <select
            value={form.rma3Category ?? ""}
            onChange={(e) => onUpdateForm({ ...form, rma3Category: (e.target.value || null) as MedForm["rma3Category"] })}
            className={selectClass}
          >
            <option value="">{ts("rma3_category_none")}</option>
            {RMA3_STOCK_CATEGORIES.map((category) => (
              <option key={category} value={category}>{ts(`rma3_category_${category}`)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>{ts("vaccine_antigen")}</Label>
          <select value={form.vaccineAntigenCode ?? ""} onChange={(e) => onUpdateForm({ ...form, vaccineAntigenCode: e.target.value || null })} className={selectClass}>
            <option value="">{ts("vaccine_antigen_none")}</option>
            {antigens.map((a) => (
              <option key={a.id} value={a.code}>{a.nameFr}</option>
            ))}
          </select>
        </div>
      </div>
      {form.vaccineAntigenCode && <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">{ts("vaccine_antigen_hint")}</p>}
    </>
  );
}

interface AddMedicationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: MedForm;
  onUpdateForm: (form: MedForm) => void;
  saving: boolean;
  error?: string | null;
  onSubmit: () => Promise<void>;
}

export function AddMedicationSheet({ open, onOpenChange, form, onUpdateForm, saving, error, onSubmit }: AddMedicationSheetProps) {
  const t = useTranslations("pharmacy");
  const ts = useTranslations("stock");
  const tc = useTranslations("common");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("add_medication")}</SheetTitle>
          <SheetDescription className="text-xs">{t("add_medication_desc")}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <ItemFields form={form} onUpdateForm={onUpdateForm} />
          <p className="text-[11px] text-slate-500">{ts("initial_stock_hint")}</p>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc("cancel")}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" disabled={saving || !form.name.trim()} onClick={onSubmit}>
            {saving ? t("saving") : tc("save")}
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
  error?: string | null;
  onSubmit: () => Promise<void>;
}

export function EditMedicationSheet({ open, onOpenChange, form, onUpdateForm, saving, error, onSubmit }: EditMedicationSheetProps) {
  const t = useTranslations("pharmacy");
  const ts = useTranslations("stock");
  const tc = useTranslations("common");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("edit_medication")}</SheetTitle>
          <SheetDescription className="text-xs">{t("edit_medication_desc")}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          {form && (
            <>
              <div className="bg-slate-100 p-3 rounded border border-slate-200 text-xs flex justify-between">
                <span className="font-bold text-slate-500 uppercase">{t("current_stock")}</span>
                <span className="font-mono font-bold text-slate-900">{form.stock} {form.unit}</span>
              </div>
              <p className="text-[11px] text-slate-500 -mt-2">{ts("stock_read_only_hint")}</p>
              <ItemFields form={form} onUpdateForm={onUpdateForm} />
            </>
          )}
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={saving}>{tc("cancel")}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" disabled={saving || !form?.name.trim()} onClick={onSubmit}>
            {saving ? t("saving") : tc("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
