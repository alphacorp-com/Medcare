"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock, CheckCircle2, Clock, Plus, UserX, ChevronLeft, ChevronRight,
} from "lucide-react";
import { NewAppointmentSheet } from "./_components/NewAppointmentSheet";
import { AppointmentDetailSheet } from "./_components/AppointmentDetailSheet";
import { Appointment, Doctor } from "./types";

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export default function AppointmentsPage() {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const hasModule = useAppStore((state) => state.hasModule);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [doctorFilter, setDoctorFilter] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [tomorrowCount, setTomorrowCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);

  const doctorsById = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  const fetchAppointments = async () => {
    try {
      const { start, end } = dayBounds(selectedDate);
      const params = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });
      if (doctorFilter) params.set("doctorId", doctorFilter);
      const res = await fetch(`/api/v1/appointments?${params.toString()}`);
      const json = await res.json();
      if (json.success) setAppointments(json.data);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTomorrowCount = async () => {
    try {
      const tomorrow = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000);
      const { start, end } = dayBounds(tomorrow);
      const params = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });
      const res = await fetch(`/api/v1/appointments?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTomorrowCount(
          (json.data as Appointment[]).filter((a) => a.status === "booked" || a.status === "confirmed").length
        );
      }
    } catch {
      setTomorrowCount(0);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch("/api/v1/doctors");
      const json = await res.json();
      if (json.success) setDoctors(json.data);
    } catch (err) {
      console.error("Failed to fetch doctors", err);
    }
  };

  useEffect(() => {
    if (!hasModule("MODULE_APPOINTMENTS")) return;
    (async () => {
      await fetchDoctors();
    })();
  }, [hasModule]);

  useEffect(() => {
    if (!hasModule("MODULE_APPOINTMENTS")) return;
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchAppointments(), fetchTomorrowCount()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, doctorFilter, hasModule]);

  if (!hasModule("MODULE_APPOINTMENTS")) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tc("restricted_access")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("module_desc")}</p>
          <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
            {tc("contact_admin")}
          </p>
        </div>
      </div>
    );
  }

  const doctorName = (id: string) => doctorsById.get(id)?.fullName ?? id;

  const quickCheckIn = async (appointment: Appointment) => {
    try {
      const res = await fetch(`/api/v1/appointments/${appointment.id}/check-in`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload?.error || t("action_error"));
        return;
      }
      toast.success(t("checked_in_success"));
      fetchAppointments();
    } catch {
      toast.error(t("action_error"));
    }
  };

  const isToday = dayBounds(selectedDate).start.getTime() === dayBounds(new Date()).start.getTime();
  const waitingCount = appointments.filter((a) => a.status === "booked" || a.status === "confirmed").length;
  const checkedInCount = appointments.filter((a) => a.status === "checked_in" || a.status === "completed").length;
  const noShowCount = appointments.filter((a) => a.status === "no_show").length;

  const statusBadgeClass = (status: Appointment["status"]) =>
    cn(
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
      status === "booked" ? "bg-slate-100 text-slate-600" :
      status === "confirmed" ? "bg-blue-100 text-blue-700" :
      status === "checked_in" ? "bg-green-100 text-green-700" :
      status === "completed" ? "bg-emerald-100 text-emerald-700" :
      status === "no_show" ? "bg-amber-100 text-amber-700" :
      "bg-red-100 text-red-700"
    );

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
        </div>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={() => setIsNewOpen(true)}>
          <Plus className="mr-2 h-3.5 w-3.5" /> {t("new_appointment")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("waiting")}</div>
            <div className="text-3xl font-bold text-slate-900">{waitingCount}</div>
          </div>
          <Clock className="h-8 w-8 text-slate-200" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">{t("checked_in")}</div>
            <div className="text-3xl font-bold text-green-600">{checkedInCount}</div>
          </div>
          <CheckCircle2 className="h-8 w-8 text-green-100" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">{t("no_show")}</div>
            <div className="text-3xl font-bold text-amber-600">{noShowCount}</div>
          </div>
          <UserX className="h-8 w-8 text-amber-100" />
        </div>
        <button
          className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors text-left"
          onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000))}
        >
          <div>
            <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">{t("tomorrow_to_confirm")}</div>
            <div className="text-3xl font-bold text-purple-600">{tomorrowCount}</div>
          </div>
          <CalendarClock className="h-8 w-8 text-purple-100" />
        </button>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="text-sm font-semibold text-slate-700 min-w-[10rem] text-center">
              {isToday ? t("today") : format(selectedDate, "MMM d, yyyy")}
            </div>
            <Button variant="outline" size="icon-sm" onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            {!isToday && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDate(new Date())}>
                {t("today")}
              </Button>
            )}
          </div>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="h-8 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700"
          >
            <option value="">{tc("all")}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.fullName}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">{tc("loading")}</div>
          ) : appointments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm flex-col">
              <CalendarClock className="h-8 w-8 mb-2 opacity-50" />
              {t("no_appointments")}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  <th className="p-4 font-semibold w-24">{tc("time")}</th>
                  <th className="p-4 font-semibold w-48">{tc("patient")}</th>
                  <th className="p-4 font-semibold w-40">{t("doctor")}</th>
                  <th className="p-4 font-semibold">{t("reason_for_visit")}</th>
                  <th className="p-4 font-semibold w-32">{tc("status")}</th>
                  <th className="p-4 font-semibold text-right w-56">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 font-mono text-xs text-slate-600">{format(new Date(appt.scheduledAt), "HH:mm")}</td>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-slate-900">{appt.patient.firstName} {appt.patient.lastName}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">IPP: {appt.patient.ipp}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{doctorName(appt.doctorId)}</td>
                    <td className="p-4 text-sm text-slate-600">{appt.reasonForVisit ?? "—"}</td>
                    <td className="p-4">
                      <span className={statusBadgeClass(appt.status)}>{t(`status_${appt.status}`)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end flex-wrap gap-1.5">
                        {(appt.status === "booked" || appt.status === "confirmed") && (
                          <Button size="sm" className="h-7 text-xs bg-green-600 text-white hover:bg-green-700" onClick={() => quickCheckIn(appt)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {t("check_in")}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDetailAppointment(appt)}>
                          {tc("view")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <NewAppointmentSheet
        open={isNewOpen}
        onOpenChange={setIsNewOpen}
        doctors={doctors}
        onCreated={fetchAppointments}
      />
      <AppointmentDetailSheet
        open={Boolean(detailAppointment)}
        onOpenChange={(open) => !open && setDetailAppointment(null)}
        appointment={detailAppointment}
        doctors={doctors}
        onUpdated={fetchAppointments}
      />
    </div>
  );
}
