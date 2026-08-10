"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { CsvImportDialog } from "@/components/settings/csv-import-dialog";

type Icd10Entry = { id: string; code: string; labelFr: string; labelEn: string | null; chapter: string | null; isActive: boolean };

export default function Icd10Page() {
  const t = useTranslations("settings.icd10");
  const tc = useTranslations("common");

  const [items, setItems] = useState<Icd10Entry[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Icd10Entry | null>(null);
  const [code, setCode] = useState("");
  const [labelFr, setLabelFr] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [chapter, setChapter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async (query: string) => {
    setIsLoading(true);
    try {
      const url = new URL("/api/v1/settings/icd10", window.location.origin);
      if (query.trim()) url.searchParams.set("search", query.trim());
      const res = await fetch(url.toString());
      const json = await res.json();
      setItems(Array.isArray(json) ? json : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchItems(search);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const openCreate = () => {
    setEditingItem(null); setCode(""); setLabelFr(""); setLabelEn(""); setChapter(""); setError(null); setIsFormOpen(true);
  };
  const openEdit = (item: Icd10Entry) => {
    setEditingItem(item); setCode(item.code); setLabelFr(item.labelFr); setLabelEn(item.labelEn ?? ""); setChapter(item.chapter ?? ""); setError(null); setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !labelFr.trim()) {
      setError(t("required_fields"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = { code: code.trim(), labelFr: labelFr.trim(), labelEn: labelEn.trim() || undefined, chapter: chapter.trim() || undefined };
      const res = editingItem
        ? await fetch(`/api/v1/settings/icd10/${editingItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/v1/settings/icd10", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || t("save_error"));
        return;
      }
      setIsFormOpen(false);
      fetchItems(search);
    } catch {
      setError(t("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (item: Icd10Entry) => {
    await fetch(`/api/v1/settings/icd10/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) });
    fetchItems(search);
  };

  const handleDelete = async (item: Icd10Entry) => {
    if (!window.confirm(t("confirm_delete", { name: item.code }))) return;
    await fetch(`/api/v1/settings/icd10/${item.id}`, { method: "DELETE" });
    fetchItems(search);
  };

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
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_item")}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50">
          <Input type="search" placeholder={t("search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs bg-white border-slate-200 max-w-sm" />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                <th className="px-4 py-2">{t("code")}</th>
                <th className="px-4 py-2">{t("label")}</th>
                <th className="px-4 py-2">{t("chapter")}</th>
                <th className="px-4 py-2 text-right">{tc("status")}</th>
                <th className="px-4 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/50">
                  <td className="px-4 py-2 font-mono font-semibold text-slate-900">{item.code}</td>
                  <td className="px-4 py-2 text-slate-700">{item.labelFr}</td>
                  <td className="px-4 py-2 text-slate-400">{item.chapter}</td>
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
              {items.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400 italic text-xs">{t("no_items")}</td></tr>
              )}
            </tbody>
          </table>
        )}
        {items.length === 200 && <p className="text-[10px] text-slate-400 px-4 py-2 border-t border-slate-100">{t("results_capped")}</p>}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingItem ? t("edit_item") : t("new_item")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            <div className="space-y-1"><Label>{t("code")}</Label><Input value={code} onChange={(e) => setCode(e.target.value)} className="h-9 text-xs font-mono uppercase" /></div>
            <div className="space-y-1"><Label>{t("label_fr")}</Label><Input value={labelFr} onChange={(e) => setLabelFr(e.target.value)} className="h-9 text-xs" /></div>
            <div className="space-y-1"><Label>{t("label_en")}</Label><Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} className="h-9 text-xs" /></div>
            <div className="space-y-1"><Label>{t("chapter")}</Label><Input value={chapter} onChange={(e) => setChapter(e.target.value)} className="h-9 text-xs" /></div>
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
        importUrl="/api/v1/settings/icd10/import"
        expectedColumns={["code", "labelFr", "labelEn", "chapter"]}
        onImported={() => fetchItems(search)}
      />
    </div>
  );
}
