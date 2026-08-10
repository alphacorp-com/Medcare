"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BedStatus = "available" | "occupied" | "maintenance" | "reserved";
type Bed = {
  id: string; code: string; label: string; departmentId: string; roomTypeId: string | null;
  status: BedStatus; currentStayId: string | null; isActive: boolean;
};
type Department = { id: string; code: string; name: string };
type RoomType = { id: string; code: string; nameFr: string };

const STATUS_STYLES: Record<BedStatus, string> = {
  available: "bg-green-100 text-green-700",
  occupied: "bg-red-100 text-red-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  reserved: "bg-blue-100 text-blue-700",
};

const EMPTY_FORM = { code: "", label: "", departmentId: "", roomTypeId: "", status: "available" as BedStatus };

export default function BedsPage() {
  const t = useTranslations("settings.beds");
  const tc = useTranslations("common");

  const [items, setItems] = useState<Bed[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Bed | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const [bedsRes, deptsRes, roomTypesRes] = await Promise.all([
        fetch("/api/v1/settings/beds?includeInactive=true"),
        fetch("/api/v1/departments"),
        fetch("/api/v1/settings/reference-data/room_type"),
      ]);
      const beds = await bedsRes.json();
      const deptsJson = await deptsRes.json();
      const roomTypesJson = await roomTypesRes.json();
      setItems(Array.isArray(beds) ? beds : []);
      setDepartments(Array.isArray(deptsJson?.data) ? deptsJson.data : []);
      setRoomTypes(Array.isArray(roomTypesJson) ? roomTypesJson : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAll();
    })();
  }, []);

  const departmentName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;
  const roomTypeName = (id: string | null) => (id ? roomTypes.find((r) => r.id === id)?.nameFr : null);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM, departmentId: departments[0]?.id ?? "" });
    setError(null);
    setIsFormOpen(true);
  };

  const openEdit = (item: Bed) => {
    setEditingItem(item);
    setForm({
      code: item.code, label: item.label, departmentId: item.departmentId,
      roomTypeId: item.roomTypeId ?? "", status: item.status,
    });
    setError(null);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.label.trim() || !form.departmentId) {
      setError(t("required_fields"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code.trim(),
        label: form.label.trim(),
        departmentId: form.departmentId,
        roomTypeId: form.roomTypeId || undefined,
        ...(editingItem ? { status: form.status } : {}),
      };
      const res = editingItem
        ? await fetch(`/api/v1/settings/beds/${editingItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/v1/settings/beds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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

  const toggleActive = async (item: Bed) => {
    const res = await fetch(`/api/v1/settings/beds/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body?.error || t("save_error"));
      return;
    }
    fetchAll();
  };

  const handleDelete = async (item: Bed) => {
    if (!window.confirm(t("confirm_delete", { name: item.label }))) return;
    const res = await fetch(`/api/v1/settings/beds/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body?.error || t("cannot_delete_occupied"));
      return;
    }
    fetchAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
        </div>
        <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={openCreate} disabled={departments.length === 0}>
          <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_item")}
        </Button>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-xs font-semibold text-slate-800">{item.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{item.code}</span>
                    <span>{departmentName(item.departmentId)}</span>
                    {roomTypeName(item.roomTypeId) && <span>· {roomTypeName(item.roomTypeId)}</span>}
                    {!item.isActive && <span className="text-slate-400">({tc("inactive")})</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold", STATUS_STYLES[item.status])}>
                    {t(`status_${item.status}`)}
                  </span>
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingItem ? t("edit_item") : t("new_item")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t("code")}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-9 text-xs font-mono uppercase" /></div>
              <div className="space-y-1"><Label>{t("label")}</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="h-9 text-xs" /></div>
            </div>

            <div className="space-y-1">
              <Label>{t("department")}</Label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <Label>{t("roomType")}</Label>
              <select
                value={form.roomTypeId}
                onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                <option value="">—</option>
                {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.nameFr}</option>)}
              </select>
            </div>

            {editingItem && (
              <div className="space-y-1">
                <Label>{t("status")}</Label>
                {editingItem.currentStayId ? (
                  <p className="text-[10px] text-slate-400">{t("occupied_tooltip")}</p>
                ) : (
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as BedStatus })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                  >
                    <option value="available">{t("status_available")}</option>
                    <option value="maintenance">{t("status_maintenance")}</option>
                    <option value="reserved">{t("status_reserved")}</option>
                  </select>
                )}
              </div>
            )}
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
