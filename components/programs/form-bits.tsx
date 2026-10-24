"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

// Small form pieces shared by the program screens (nutrition, oxygen, blood bank, staff).

export const selectClass =
  "flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 ${className ?? ""}`}>
      <span className="block text-[10px] font-bold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
      {label}
    </label>
  );
}

// Yes / no / not asked (null).
export function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  const t = useTranslations("programs");
  return (
    <Field label={label}>
      <select value={value === null ? "" : value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "yes")} className={selectClass}>
        <option value="">—</option>
        <option value="yes">{t("yes")}</option>
        <option value="no">{t("no")}</option>
      </select>
    </Field>
  );
}

export const today = () => new Date().toISOString().slice(0, 10);
export const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
