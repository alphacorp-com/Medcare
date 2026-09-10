"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

type ActCategory = {
  id: string;
  code: string;
  nameFr: string;
  nameEn: string | null;
  color: string | null;
  order: number;
  isActive: boolean;
  _count: { acts: number };
};

export default function ActCategoriesPage() {
  const t = useTranslations("settings.actCategories");
  const tc = useTranslations("common");

  const [items, setItems] = useState<ActCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActCategory | null>(null);

  const [code, setCode] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [color, setColor] = useState("#1565c0");
  const [order, setOrder] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/v1/settings/act-categories");
      const json = await res.json();
      setItems(Array.isArray(json) ? json : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchItems();
    })();
  }, []);

  const openCreate = () => {
    setEditingItem(null);
    setCode("");
    setNameFr("");
    setNameEn("");
    setColor("#1565c0");
    setOrder("0");
    setError(null);
    setIsFormOpen(true);
  };

  const openEdit = (item: ActCategory) => {
    setEditingItem(item);
    setCode(item.code);
    setNameFr(item.nameFr);
    setNameEn(item.nameEn ?? "");
    setColor(item.color ?? "#1565c0");
    setOrder(String(item.order));
    setError(null);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !nameFr.trim()) {
      setError(t("required_fields"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = { code: code.trim(), nameFr: nameFr.trim(), nameEn: nameEn.trim() || undefined, color, order: Number(order) || 0 };
      const res = editingItem
        ? await fetch(`/api/v1/settings/act-categories/${editingItem.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          })
        : await fetch("/api/v1/settings/act-categories", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || t("save_error"));
        return;
      }
      setIsFormOpen(false);
      fetchItems();
    } catch {
      setError(t("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (item: ActCategory) => {
    await fetch(`/api/v1/settings/act-categories/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }),
    });
    fetchItems();
  };

  const handleDelete = async (item: ActCategory) => {
    if (item._count.acts > 0) {
      window.alert(t("delete_blocked"));
      return;
    }
    if (!window.confirm(t("confirm_delete", { name: item.nameFr }))) return;
    await fetch(`/api/v1/settings/act-categories/${item.id}`, { method: "DELETE" });
    fetchItems();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
        </div>
        <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_item")}
        </Button>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded text-[11px] font-bold text-white" style={{ backgroundColor: item.color || "#64748b" }}>
                    {item.nameFr}
                  </span>
                  <div className="text-xs text-slate-500">
                    {item.nameEn && <span>{item.nameEn}</span>}
                    <span className="ml-2 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{item.code}</span>
                    <span className="ml-2 text-slate-400">{t("acts_count", { count: item._count.acts })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleActive(item)} className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${item.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {item.isActive ? tc("active") : tc("inactive")}
                  </button>
                  <button onClick={() => openEdit(item)} className="text-slate-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(item)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
            {items.length === 0 && <div className="text-center py-10 text-slate-400 italic text-xs">{t("no_items")}</div>}
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? t("edit_item") : t("new_item")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t("code")}</Label><Input value={code} onChange={(e) => setCode(e.target.value)} className="h-9 text-xs font-mono uppercase" /></div>
              <div className="space-y-1"><Label>{t("order")}</Label><Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="h-9 text-xs" /></div>
            </div>
            <div className="space-y-1"><Label>{t("name_fr")}</Label><Input value={nameFr} onChange={(e) => setNameFr(e.target.value)} className="h-9 text-xs" /></div>
            <div className="space-y-1"><Label>{t("name_en")}</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-9 text-xs" /></div>
            <div className="space-y-1">
              <Label>{t("color")}</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 rounded border border-slate-200" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-9 text-xs font-mono" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={isSaving} onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
