"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Doctor {
  id: string;
  fullName: string;
  specialty: string | null;
}

interface DayRow {
  weekday: number;
  label: string;
  active: boolean;
  startTime: string;
  endTime: string;
  slotMinutes: string;
}

// Displayed Monday-first for readability; weekday values stay JS-native (0=Sunday).
const WEEKDAYS = [
  { weekday: 1, key: "monday" },
  { weekday: 2, key: "tuesday" },
  { weekday: 3, key: "wednesday" },
  { weekday: 4, key: "thursday" },
  { weekday: 5, key: "friday" },
  { weekday: 6, key: "saturday" },
  { weekday: 0, key: "sunday" },
];

function emptyRows(t: (key: string) => string): DayRow[] {
  return WEEKDAYS.map((d) => ({
    weekday: d.weekday,
    label: t(d.key),
    active: false,
    startTime: "08:00",
    endTime: "16:00",
    slotMinutes: "30",
  }));
}

export default function DoctorAvailabilityPage() {
  const t = useTranslations("settings.doctorAvailability");
  const tc = useTranslations("common");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [rows, setRows] = useState<DayRow[]>(() => emptyRows(t));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/doctors")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDoctors(json.data);
      })
      .catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (!selectedDoctorId) return;
    (async () => {
      setIsLoading(true);
      setMessage(null);
      setError(null);
      try {
        const res = await fetch(`/api/v1/settings/doctor-availability?doctorId=${selectedDoctorId}`);
        const json = await res.json();
        const existing = Array.isArray(json.data) ? json.data : [];
        const base = emptyRows(t);
        const merged = base.map((row) => {
          const found = existing.find((w: { weekday: number }) => w.weekday === row.weekday);
          if (!found) return row;
          return {
            ...row,
            active: true,
            startTime: found.startTime,
            endTime: found.endTime,
            slotMinutes: String(found.slotMinutes),
          };
        });
        setRows(merged);
      } catch {
        setRows(emptyRows(t));
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctorId]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctorId(id);
    setMessage(null);
    setError(null);
    if (!id) setRows(emptyRows(t));
  };

  const updateRow = (weekday: number, patch: Partial<DayRow>) =>
    setRows((prev) => prev.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));

  const handleSave = async () => {
    if (!selectedDoctorId) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const windows = rows
        .filter((r) => r.active)
        .map((r) => ({
          weekday: r.weekday,
          startTime: r.startTime,
          endTime: r.endTime,
          slotMinutes: Number(r.slotMinutes) || 30,
        }));

      const res = await fetch("/api/v1/settings/doctor-availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: selectedDoctorId, windows }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || tc("save_error"));
        return;
      }
      setMessage(t("saved"));
    } catch {
      setError(tc("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{t("title")}</h2>
        <p className="text-xs text-slate-500">{t("description")}</p>
      </div>
      <div className="h-px bg-slate-100 w-full" />

      <div className="space-y-2 max-w-sm">
        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("select_doctor")}</Label>
        <select
          value={selectedDoctorId}
          onChange={(e) => handleDoctorChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        >
          <option value="">{t("choose_doctor")}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.fullName}{d.specialty ? ` (${d.specialty})` : ""}</option>
          ))}
        </select>
      </div>

      {selectedDoctorId && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-slate-400">{tc("loading")}</div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.weekday} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                  <label className="flex items-center gap-2 w-32 shrink-0 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(e) => updateRow(row.weekday, { active: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {row.label}
                  </label>
                  <Input
                    type="time"
                    disabled={!row.active}
                    value={row.startTime}
                    onChange={(e) => updateRow(row.weekday, { startTime: e.target.value })}
                    className="w-32 h-9 text-sm"
                  />
                  <span className="text-slate-400 text-xs">{tc("to")}</span>
                  <Input
                    type="time"
                    disabled={!row.active}
                    value={row.endTime}
                    onChange={(e) => updateRow(row.weekday, { endTime: e.target.value })}
                    className="w-32 h-9 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      disabled={!row.active}
                      value={row.slotMinutes}
                      onChange={(e) => updateRow(row.weekday, { slotMinutes: e.target.value })}
                      className="w-20 h-9 text-sm"
                    />
                    <span className="text-xs text-slate-500">{t("min_per_slot")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {tc("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
