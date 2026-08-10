"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { CsvImportDialog } from "@/components/settings/csv-import-dialog";

type Category = { id: string; nameFr: string; color: string | null };
type MedicalAct = {
  id: string;
  code: string;
  nameFr: string;
  nameEn: string | null;
  basePrice: string | number;
  unit: string | null;
  defaultPecCoveragePercent: number;
  allowsUrgencySurcharge: boolean;
  requiresLabValidation: boolean;
  isActive: boolean;
  category: Category;
};

const EMPTY_FORM = {
  categoryId: "", code: "", nameFr: "", nameEn: "", basePrice: "", unit: "",
  defaultPecCoveragePercent: "0", allowsUrgencySurcharge: false, requiresLabValidation: false,
};

export default function MedicalActsPage() {
  const t = useTranslations("settings.medicalActs");
  const tc = useTranslations("common");

  const [items, setItems] = useState<MedicalAct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicalAct | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const [actsRes, catsRes] = await Promise.all([
        fetch("/api/v1/settings/medical-acts"),
        fetch("/api/v1/settings/act-categories"),
      ]);
      const [acts, cats] = await Promise.all([actsRes.json(), catsRes.json()]);
      setItems(Array.isArray(acts) ? acts : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAll();
    })();
  }, []);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setError(null);
    setIsFormOpen(true);
  };

  const openEdit = (item: MedicalAct) => {
    setEditingItem(item);
    setForm({
      categoryId: item.category.id,
      code: item.code,
      nameFr: item.nameFr,
      nameEn: item.nameEn ?? "",
      basePrice: String(item.basePrice),
      unit: item.unit ?? "",
      defaultPecCoveragePercent: String(item.defaultPecCoveragePercent),
      allowsUrgencySurcharge: item.allowsUrgencySurcharge,
      requiresLabValidation: item.requiresLabValidation,
    });
    setError(null);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.categoryId || !form.code.trim() || !form.nameFr.trim() || !form.basePrice) {
      setError(t("required_fields"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        categoryId: form.categoryId,
        code: form.code.trim(),
        nameFr: form.nameFr.trim(),
        nameEn: form.nameEn.trim() || undefined,
        basePrice: Number(form.basePrice),
        unit: form.unit.trim() || undefined,
        defaultPecCoveragePercent: Number(form.defaultPecCoveragePercent) || 0,
        allowsUrgencySurcharge: form.allowsUrgencySurcharge,
        requiresLabValidation: form.requiresLabValidation,
      };
      const res = editingItem
        ? await fetch(`/api/v1/settings/medical-acts/${editingItem.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          })
        : await fetch("/api/v1/settings/medical-acts", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || t("save_error"));
        return;
      }
      setIsFormOpen(false);
      fetchAll();
    } catch {
      setError(t("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (item: MedicalAct) => {
    await fetch(`/api/v1/settings/medical-acts/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }),
    });
    fetchAll();
  };

  const handleDelete = async (item: MedicalAct) => {
    if (!window.confirm(t("confirm_delete", { name: item.nameFr }))) return;
    await fetch(`/api/v1/settings/medical-acts/${item.id}`, { method: "DELETE" });
    fetchAll();
  };

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.nameFr.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-2" /> {tc("import_csv")}
          </Button>
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={openCreate} disabled={categories.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_item")}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50">
          <Input type="search" placeholder={tc("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs bg-white border-slate-200 max-w-sm" />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                <th className="px-4 py-2">{t("category")}</th>
                <th className="px-4 py-2">{t("name_fr")}</th>
                <th className="px-4 py-2">{t("code")}</th>
                <th className="px-4 py-2 text-right">{t("base_price")}</th>
                <th className="px-4 py-2 text-right">{t("pec_coverage")}</th>
                <th className="px-4 py-2 text-right">{tc("status")}</th>
                <th className="px-4 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/50">
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: item.category.color || "#64748b" }}>
                      {item.category.nameFr}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-800 font-medium">{item.nameFr}</td>
                  <td className="px-4 py-2 font-mono text-slate-500">{item.code}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(item.basePrice).toLocaleString()} XAF</td>
                  <td className="px-4 py-2 text-right font-mono">{item.defaultPecCoveragePercent}%</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => toggleActive(item)} className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${item.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {item.isActive ? tc("active") : tc("inactive")}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(item)} className="text-slate-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(item)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400 italic text-xs">{t("no_items")}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? t("edit_item") : t("new_item")}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

            <div className="space-y-1">
              <Label>{t("category")}</Label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nameFr}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t("code")}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-9 text-xs font-mono uppercase" /></div>
              <div className="space-y-1"><Label>{t("unit")}</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-9 text-xs" /></div>
            </div>

            <div className="space-y-1"><Label>{t("name_fr")}</Label><Input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} className="h-9 text-xs" /></div>
            <div className="space-y-1"><Label>{t("name_en")}</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="h-9 text-xs" /></div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t("base_price")} (XAF)</Label><Input type="number" min="0" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} className="h-9 text-xs" /></div>
              <div className="space-y-1"><Label>{t("pec_coverage")} (%)</Label><Input type="number" min="0" max="100" value={form.defaultPecCoveragePercent} onChange={(e) => setForm({ ...form, defaultPecCoveragePercent: e.target.value })} className="h-9 text-xs" /></div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.allowsUrgencySurcharge} onChange={(e) => setForm({ ...form, allowsUrgencySurcharge: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
              {t("allows_urgency_surcharge")}
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.requiresLabValidation} onChange={(e) => setForm({ ...form, requiresLabValidation: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
              {t("requires_lab_validation")}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={isSaving} onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        importUrl="/api/v1/settings/medical-acts/import"
        expectedColumns={["categoryCode", "code", "nameFr", "nameEn", "basePrice", "unit", "defaultPecCoveragePercent"]}
        onImported={fetchAll}
      />
    </div>
  );
}
