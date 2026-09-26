"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsCode, SettingsList, SettingsListItem, SettingsPageHeader, settingsActionButtonClass } from "@/components/settings/settings-ui";

type Supplier = { id: string; code: string; name: string; contactName: string | null; phone: string | null; email: string | null; address: string | null; isActive: boolean };
const EMPTY = { code: "", name: "", contactName: "", phone: "", email: "", address: "" };

export default function SuppliersPage() {
  const t = useTranslations("settings.suppliers");
  const tc = useTranslations("common");

  const [items, setItems] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/v1/settings/suppliers");
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

  const openCreate = () => { setEditingItem(null); setForm(EMPTY); setError(null); setIsFormOpen(true); };
  const openEdit = (item: Supplier) => {
    setEditingItem(item);
    setForm({ code: item.code, name: item.name, contactName: item.contactName ?? "", phone: item.phone ?? "", email: item.email ?? "", address: item.address ?? "" });
    setError(null); setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError(t("required_fields"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code.trim(), name: form.name.trim(),
        contactName: form.contactName.trim() || undefined, phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined, address: form.address.trim() || undefined,
      };
      const res = editingItem
        ? await fetch(`/api/v1/settings/suppliers/${editingItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/v1/settings/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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

  const toggleActive = async (item: Supplier) => {
    await fetch(`/api/v1/settings/suppliers/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) });
    fetchItems();
  };

  const handleDelete = async (item: Supplier) => {
    if (!window.confirm(t("confirm_delete", { name: item.name }))) return;
    await fetch(`/api/v1/settings/suppliers/${item.id}`, { method: "DELETE" });
    fetchItems();
  };

  return (
    <div className="space-y-4">
      <SettingsPageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" className={cn("h-8 text-xs bg-blue-600 hover:bg-blue-700", settingsActionButtonClass)} onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_item")}
          </Button>
        }
      />

      <SettingsList isLoading={isLoading} isEmpty={items.length === 0} emptyLabel={t("no_items")}>
        {items.map((item) => (
          <SettingsListItem
            key={item.id}
            title={item.name}
            meta={
              <>
                <SettingsCode>{item.code}</SettingsCode>
                {item.contactName && <span>{item.contactName}</span>}
                {item.phone && <span>{item.phone}</span>}
                {item.email && <span className="break-all">{item.email}</span>}
              </>
            }
            active={{ value: item.isActive, onToggle: () => toggleActive(item) }}
            actions={[
              { label: tc("edit"), icon: Pencil, onClick: () => openEdit(item) },
              { label: tc("delete"), icon: Trash2, tone: "danger", onClick: () => handleDelete(item) },
            ]}
          />
        ))}
      </SettingsList>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingItem ? t("edit_item") : t("new_item")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            <div className="space-y-1"><Label>{t("code")}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-9 text-xs font-mono uppercase" /></div>
            <div className="space-y-1"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-xs" /></div>
            <div className="space-y-1"><Label>{t("contact_name")}</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="h-9 text-xs" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 text-xs" /></div>
              <div className="space-y-1"><Label>{t("email")}</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-xs" /></div>
            </div>
            <div className="space-y-1"><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-9 text-xs" /></div>
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
