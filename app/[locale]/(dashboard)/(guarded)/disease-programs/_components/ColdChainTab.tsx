"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { DEFAULT_TEMPERATURE_RANGE, EQUIPMENT_STATUSES, EQUIPMENT_TYPES, type EquipmentType } from "@/lib/epi/input";
import { cn } from "@/lib/utils";
import { EpiMonthPicker, currentMonth, epiSelectClass, useEpiApiError } from "./epi-shared";

// RMA3 III.4: cold chain equipment, temperature readings (twice a day) and alarms.

type Equipment = {
  id: string;
  code: string;
  type: EquipmentType;
  label: string;
  minTempC: number;
  maxTempC: number;
  status: (typeof EQUIPMENT_STATUSES)[number];
  lastReading: { readAt: string; temperatureC: number } | null;
  outOfRange: boolean;
};

type Reading = {
  id: string;
  readAt: string;
  temperatureC: number;
  notes: string | null;
  equipmentCode: string;
  equipmentLabel: string;
  alarm: "low" | "high" | null;
};

const json = (body: unknown, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function ColdChainTab({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("diseasePrograms.epi");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const apiError = useEpiApiError();
  const [month, setMonth] = useState(currentMonth);
  const emptyEquipment = { code: "", type: "refrigerator" as EquipmentType, label: "", minTempC: "2", maxTempC: "8" };
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipment);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [reading, setReading] = useState({ equipmentId: "", temperatureC: "", notes: "" });

  const equipmentQuery = useQuery({ queryKey: ["cold-chain", "equipment"], queryFn: () => apiFetch<{ data: Equipment[] }>("/api/v1/cold-chain/equipment") });
  const readingsQuery = useQuery({ queryKey: ["cold-chain", "readings", month], queryFn: () => apiFetch<{ data: Reading[] }>(`/api/v1/cold-chain/readings?month=${month}`) });
  const equipment = equipmentQuery.data?.data ?? [];
  const readings = readingsQuery.data?.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["cold-chain"] });

  const createEquipment = useMutation({
    mutationFn: () => apiFetch("/api/v1/cold-chain/equipment", json(equipmentForm)),
    onSuccess: () => {
      setEquipmentForm(emptyEquipment);
      setShowEquipmentForm(false);
      toast.success(t("saved"));
      return refresh();
    },
    onError: (error) => toast.error(apiError(error)),
  });
  const updateStatus = useMutation({
    mutationFn: (e: Equipment & { status: Equipment["status"] }) =>
      apiFetch(`/api/v1/cold-chain/equipment/${e.id}`, json({ code: e.code, type: e.type, label: e.label, minTempC: e.minTempC, maxTempC: e.maxTempC, status: e.status }, "PATCH")),
    onSuccess: refresh,
    onError: (error) => toast.error(apiError(error)),
  });
  const addReading = useMutation({
    mutationFn: () => apiFetch<{ data: { alarm: "low" | "high" | null } }>("/api/v1/cold-chain/readings", json(reading)),
    onSuccess: (result) => {
      setReading({ ...reading, temperatureC: "", notes: "" });
      if (result.data.alarm) toast.warning(t(`alarm_${result.data.alarm}_toast`));
      else toast.success(t("saved"));
      return refresh();
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const alarms = readings.filter((r) => r.alarm);
  const temps = readings.map((r) => r.temperatureC);

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Equipment */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{t("equipment_title")}</h3>
          {canEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowEquipmentForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t("equipment_add")}
            </Button>
          )}
        </div>
        {showEquipmentForm && (
          <form
            className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              createEquipment.mutate();
            }}
          >
            <label className="space-y-1">
              <span className="block text-[10px] font-bold uppercase text-slate-500">{t("equipment_code")}</span>
              <Input required maxLength={40} value={equipmentForm.code} onChange={(e) => setEquipmentForm({ ...equipmentForm, code: e.target.value })} className="h-8 w-28 text-xs font-mono" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-bold uppercase text-slate-500">{t("equipment_type")}</span>
              <select
                value={equipmentForm.type}
                onChange={(e) => {
                  const type = e.target.value as EquipmentType;
                  const range = DEFAULT_TEMPERATURE_RANGE[type];
                  setEquipmentForm({ ...equipmentForm, type, minTempC: String(range.min), maxTempC: String(range.max) });
                }}
                className={cn(epiSelectClass, "w-40")}
              >
                {EQUIPMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{t(`equipment_type_${type}`)}</option>
                ))}
              </select>
            </label>
            <label className="flex-1 min-w-40 space-y-1">
              <span className="block text-[10px] font-bold uppercase text-slate-500">{t("equipment_label")}</span>
              <Input required maxLength={150} value={equipmentForm.label} onChange={(e) => setEquipmentForm({ ...equipmentForm, label: e.target.value })} className="h-8 text-xs" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-bold uppercase text-slate-500">{t("equipment_min")}</span>
              <Input type="number" step="0.5" value={equipmentForm.minTempC} onChange={(e) => setEquipmentForm({ ...equipmentForm, minTempC: e.target.value })} className="h-8 w-20 text-xs" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-bold uppercase text-slate-500">{t("equipment_max")}</span>
              <Input type="number" step="0.5" value={equipmentForm.maxTempC} onChange={(e) => setEquipmentForm({ ...equipmentForm, maxTempC: e.target.value })} className="h-8 w-20 text-xs" />
            </label>
            <Button type="submit" size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-xs" disabled={createEquipment.isPending}>
              {t("save")}
            </Button>
          </form>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {equipmentQuery.isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {!equipmentQuery.isPending && equipment.length === 0 && <p className="text-xs text-slate-500">{t("equipment_empty")}</p>}
          {equipment.map((e) => (
            <div key={e.id} className={cn("rounded border bg-white p-3 text-xs space-y-1", e.outOfRange ? "border-red-300" : "border-slate-200")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">
                  <span className="font-mono text-slate-500">{e.code}</span> {e.label}
                </span>
                {canEdit ? (
                  <select
                    value={e.status}
                    onChange={(ev) => updateStatus.mutate({ ...e, status: ev.target.value as Equipment["status"] })}
                    aria-label={t("equipment_status")}
                    className={cn(epiSelectClass, "h-7")}
                  >
                    {EQUIPMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>{t(`equipment_status_${s}`)}</option>
                    ))}
                  </select>
                ) : (
                  <span>{t(`equipment_status_${e.status}`)}</span>
                )}
              </div>
              <div className="text-slate-500">
                {t(`equipment_type_${e.type}`)} · {t("equipment_range", { min: e.minTempC, max: e.maxTempC })}
              </div>
              <div className={cn("flex items-center gap-1", e.outOfRange ? "font-semibold text-red-700" : "text-slate-600")}>
                <Thermometer className="h-3.5 w-3.5" />
                {e.lastReading
                  ? t("equipment_last_reading", { temperature: e.lastReading.temperatureC, at: format.dateTime(new Date(e.lastReading.readAt), { dateStyle: "short", timeStyle: "short" }) })
                  : t("equipment_no_reading")}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Readings */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{t("readings_title")}</h3>
        {canEdit && equipment.length > 0 && (
          <form
            className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              addReading.mutate();
            }}
          >
            <label className="space-y-1">
              <span className="block text-[10px] font-bold uppercase text-slate-500">{t("reading_equipment")}</span>
              <select required value={reading.equipmentId} onChange={(e) => setReading({ ...reading, equipmentId: e.target.value })} className={cn(epiSelectClass, "w-52")}>
                <option value="">—</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>{e.code} — {e.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-bold uppercase text-slate-500">{t("reading_temperature")}</span>
              <Input required inputMode="decimal" value={reading.temperatureC} onChange={(e) => setReading({ ...reading, temperatureC: e.target.value })} className="h-8 w-24 text-xs font-mono" />
            </label>
            <label className="flex-1 min-w-40 space-y-1">
              <span className="block text-[10px] font-bold uppercase text-slate-500">{t("reading_notes")}</span>
              <Input maxLength={255} value={reading.notes} onChange={(e) => setReading({ ...reading, notes: e.target.value })} className="h-8 text-xs" />
            </label>
            <Button type="submit" size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-xs" disabled={addReading.isPending}>
              {t("reading_add")}
            </Button>
          </form>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <EpiMonthPicker month={month} onChange={setMonth} />
          <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs">
            {t("readings_summary", {
              count: readings.length,
              min: temps.length ? Math.min(...temps) : "—",
              max: temps.length ? Math.max(...temps) : "—",
            })}
          </div>
          {alarms.length > 0 && (
            <div className="flex items-center gap-1 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" /> {t("readings_alarms", { count: alarms.length })}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("reading_at")}</th>
                <th className="px-3 py-2">{t("reading_equipment")}</th>
                <th className="px-3 py-2 text-right">{t("reading_temperature")}</th>
                <th className="px-3 py-2">{t("reading_notes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!readingsQuery.isPending && readings.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-500">{t("readings_empty")}</td></tr>
              )}
              {readings.map((r) => (
                <tr key={r.id} className={cn(r.alarm && "bg-red-50/60")}>
                  <td className="px-3 py-2 whitespace-nowrap">{format.dateTime(new Date(r.readAt), { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-3 py-2">{r.equipmentCode} — {r.equipmentLabel}</td>
                  <td className={cn("px-3 py-2 text-right font-mono", r.alarm && "font-bold text-red-700")}>
                    {r.temperatureC} °C{r.alarm ? ` (${t(`alarm_${r.alarm}`)})` : ""}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{r.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
