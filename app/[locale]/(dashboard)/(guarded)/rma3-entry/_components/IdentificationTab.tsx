"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";
import { OWNERSHIP_VALUES, type Rma3IdentificationSettings } from "@/lib/rma3-manual/input";
import { selectClass, useRma3ApiError } from "./shared";

// The MINSANTE identification of the facility (RMA3 section I): rarely changes, printed at
// the top of every RMA3.

type TextField = "region" | "department" | "arrondissement" | "district" | "healthArea" | "facilityManagerName" | "dataManagerName" | "dataManagerPhone";
const TEXT_FIELDS: TextField[] = ["region", "department", "arrondissement", "district", "healthArea", "facilityManagerName", "dataManagerName", "dataManagerPhone"];

const QUERY_KEY = ["rma3-entry", "identification"];

export function IdentificationTab() {
  const apiError = useRma3ApiError();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: () => apiFetch<{ data: Rma3IdentificationSettings }>("/api/v1/rma3-entry/identification") });
  if (query.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />;
  if (query.isError || !query.data) return <p className="text-xs text-red-600">{apiError(query.error)}</p>;
  // Remounted on each server load, so the form starts from what is stored.
  return <IdentificationForm key={JSON.stringify(query.data.data)} initial={query.data.data} />;
}

function IdentificationForm({ initial }: { initial: Rma3IdentificationSettings }) {
  const t = useTranslations("rma3Entry");
  const apiError = useRma3ApiError();
  const queryClient = useQueryClient();
  const canEdit = useAppStore((state) => state.hasPermission("MODULE_RMA3", "update"));
  const [form, setForm] = useState<Rma3IdentificationSettings>(initial);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<{ data: Rma3IdentificationSettings }>("/api/v1/rma3-entry/identification", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(QUERY_KEY, { data });
      toast.success(t("saved"));
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const setNumber = (field: "villagesServed" | "villagesOutreach", raw: string) =>
    setForm((f) => ({ ...f, [field]: raw.trim() === "" ? null : Number(raw) }));

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-[11px] text-slate-500">{t("identification_hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEXT_FIELDS.map((field) => (
          <label key={field} className="space-y-1">
            <span className="block text-[10px] font-bold uppercase text-slate-500">{t(`field_${field}`)}</span>
            <Input
              value={form[field] ?? ""}
              disabled={!canEdit}
              maxLength={field === "dataManagerPhone" ? 30 : field.endsWith("Name") ? 150 : 100}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="h-8 text-xs"
            />
          </label>
        ))}
        {(["villagesServed", "villagesOutreach"] as const).map((field) => (
          <label key={field} className="space-y-1">
            <span className="block text-[10px] font-bold uppercase text-slate-500">{t(`field_${field}`)}</span>
            <Input type="number" min={0} step={1} value={form[field] ?? ""} disabled={!canEdit} onChange={(e) => setNumber(field, e.target.value)} className="h-8 w-32 text-xs" />
          </label>
        ))}
        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase text-slate-500">{t("field_ownership")}</span>
          <select
            value={form.ownership ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, ownership: (e.target.value || null) as Rma3IdentificationSettings["ownership"] }))}
            className={selectClass}
          >
            <option value="">—</option>
            {OWNERSHIP_VALUES.map((value) => (
              <option key={value} value={value}>{t(`ownership_${value}`)}</option>
            ))}
          </select>
        </label>
      </div>
      {canEdit && (
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t("save")}
        </Button>
      )}
    </div>
  );
}
