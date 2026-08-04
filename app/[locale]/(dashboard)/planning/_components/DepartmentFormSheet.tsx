"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Building2, Loader2 } from "lucide-react";
import { DEPARTMENT_TYPES } from "@/lib/planning/shifts";
import { DepartmentForm, DepartmentRecord, StaffMember } from "../types";

const emptyForm = (department: DepartmentRecord | null): DepartmentForm => ({
  name: department?.name ?? "",
  code: department?.code ?? "",
  type: department?.type ?? "",
  headId: department?.headId ?? "",
  phone: department?.phone ?? "",
  location: department?.location ?? "",
});

export function DepartmentFormSheet({
  open,
  onOpenChange,
  department,
  staff,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentRecord | null;
  staff: StaffMember[];
  onSaved: () => void;
}) {
  const t = useTranslations("planning");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");

  const [form, setForm] = useState<DepartmentForm>(emptyForm(department));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof DepartmentForm>(key: K, value: DepartmentForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError(t("department_fields_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(department ? `/api/v1/departments/${department.id}` : "/api/v1/departments", {
        method: department ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          type: form.type || null,
          headId: form.headId || null,
          phone: form.phone || null,
          location: form.location || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("department_save_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("department_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!department) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/departments/${department.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !department.isActive }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("department_save_error"));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(t("department_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-sm w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-600" /> {department ? t("edit_department") : t("create_department")}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("department_name")}</label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Pediatrics" className="h-9 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("department_code")}</label>
              <Input value={form.code} onChange={(e) => update("code", e.target.value.toUpperCase())} placeholder="PEDS" className="h-9 text-xs font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("classification")}</label>
              <select
                value={form.type}
                onChange={(e) => update("type", e.target.value as DepartmentForm["type"])}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                <option value="">{t("unspecified")}</option>
                {DEPARTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{t(`department_types.${type}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("department_head")}</label>
              <select
                value={form.headId}
                onChange={(e) => update("headId", e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                <option value="">{t("unassigned")}</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName} ({tr(s.role)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{tc("phone")}</label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("location")}</label>
              <Input value={form.location} onChange={(e) => update("location", e.target.value)} className="h-9 text-xs" />
            </div>

            {department && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={handleToggleActive}
                className={department.isActive ? "text-red-700 border-red-200 hover:bg-red-50" : "text-green-700 border-green-200 hover:bg-green-50"}
              >
                {department.isActive ? t("deactivate_department") : t("reactivate_department")}
              </Button>
            )}
          </div>

          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">{tc("cancel")}</Button>
            <Button type="submit" disabled={isSaving} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              {department ? tc("save_changes") : t("create_structure")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
