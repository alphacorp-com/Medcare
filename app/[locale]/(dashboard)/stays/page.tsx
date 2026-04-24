"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Search, Bed, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

type StayRow = {
  id: string;
  stayNumber: string;
  type: string;
  status: string;
  admissionDate: string;
  dischargeDate: string | null;
  dischargeSummary: string | null;
  pmsiCode: string | null;
  pmsiValidated: boolean;
  patient: {
    firstName: string;
    lastName: string;
    ipp: string;
  };
};

type Department = {
  id: string;
  code: string;
  name: string;
  type: string | null;
};

type Doctor = {
  id: string;
  fullName: string;
  specialty: string | null;
};

type NewStayForm = {
  patientId: string;
  type: "emergency" | "scheduled" | "day_care" | "outpatient";
  admissionReason: string;
  departmentId: string;
  bedId: string;
  attendingDoctorId: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdmissionsPage() {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const tp = useTranslations("patients");
  const hasModule = useAppStore((state) => state.hasModule);
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [isNewAdmissionOpen, setIsNewAdmissionOpen] = useState(false);

  const [stays, setStays] = useState<StayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [stayForm, setStayForm] = useState<NewStayForm>({
    patientId: "",
    type: "emergency",
    admissionReason: "",
    departmentId: "",
    bedId: "",
    attendingDoctorId: "",
  });
  const [savingStay, setSavingStay] = useState(false);
  const [stayError, setStayError] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const fetchStays = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/stays");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load stays");
      setStays(json.data as StayRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stays");
      setStays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStays();
    // Load reference data for dropdowns
    Promise.all([
      fetch("/api/v1/departments").then((r) => r.json()),
      fetch("/api/v1/doctors").then((r) => r.json()),
    ]).then(([deptJson, docJson]) => {
      if (deptJson.success) setDepartments(deptJson.data as Department[]);
      if (docJson.success) setDoctors(docJson.data as Doctor[]);
    });
  }, []);

  // ── Form helpers ────────────────────────────────────────────────────────────

  const updateStayForm = <K extends keyof NewStayForm>(key: K, value: NewStayForm[K]) => {
    setStayForm((prev) => ({ ...prev, [key]: value }));
  };

  const openNewAdmissionSheet = () => {
    setStayForm({
      patientId: "",
      type: "emergency",
      admissionReason: "",
      departmentId: "",
      bedId: "",
      attendingDoctorId: "",
    });
    setStayError(null);
    setIsNewAdmissionOpen(true);
  };

  const handleSaveStay = async () => {
    if (savingStay || !stayForm.patientId) return;
    setSavingStay(true);
    setStayError(null);
    try {
      const payload = {
        type: stayForm.type,
        admissionReason: stayForm.admissionReason || null,
        departmentId: stayForm.departmentId || null,
        bedId: stayForm.bedId || null,
        attendingDoctorId: stayForm.attendingDoctorId || null,
      };
      const res = await fetch(`/api/v1/patients/${stayForm.patientId}/stays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to create stay");
      setIsNewAdmissionOpen(false);
      await fetchStays();
    } catch (e) {
      setStayError(e instanceof Error ? e.message : "Failed to create stay");
    } finally {
      setSavingStay(false);
    }
  };

  // ── Guard: module ───────────────────────────────────────────────────────────

  if (!hasModule("MODULE_ADMISSION")) {
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 text-slate-700"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-3 w-3" />
            {tp("advanced_filters")}
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
            onClick={openNewAdmissionSheet}
          >
            <Bed className="mr-2 h-3 w-3" />
            {t("new_admission")}
          </Button>
        </div>
      </div>

      {/* Table card */}
      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="relative w-96">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder={tc("search")}
                className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-normal italic">
                Updated 1m ago
              </span>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 pt-2 mt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  {tc("status")}:
                </label>
                <select className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700">
                  <option>{tc("all")}</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pre_admission">Pre-Admission</option>
                  <option value="discharged">Discharged</option>
                  <option value="transferred">Transferred</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  {t("arrival_mode")}:
                </label>
                <select className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700">
                  <option>{tc("all")}</option>
                  <option value="emergency">Emergency</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="day_care">Day Care</option>
                  <option value="outpatient">Outpatient</option>
                </select>
              </div>
              <Button size="sm" variant="secondary" className="h-7 text-xs ml-auto">
                {tp("apply_filters")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-slate-500"
                onClick={() => setShowFilters(false)}
              >
                {tp("clear")}
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-xs text-slate-500">Loading…</div>
          ) : error ? (
            <div className="flex items-center justify-center h-24 text-xs text-red-500">{error}</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                  <th className="px-4 py-2">{t("stay_number")}</th>
                  <th className="px-4 py-2">{tc("patient")}</th>
                  <th className="px-4 py-2">{tc("type")}</th>
                  <th className="px-4 py-2">{tc("admission_date")}</th>
                  <th className="px-4 py-2">{tc("discharge_date")}</th>
                  <th className="px-4 py-2">PMSI</th>
                  <th className="px-4 py-2">{tc("status")}</th>
                  <th className="px-4 py-2 text-right">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {stays.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500 italic">
                      No stays found.
                    </td>
                  </tr>
                )}
                {stays.map((stay) => (
                  <tr
                    key={stay.id}
                    className="hover:bg-blue-50/50 cursor-pointer"
                    onClick={() => router.push(`/stays/${stay.id}`)}
                  >
                    <td className="px-4 py-2 font-mono text-slate-600">{stay.stayNumber}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {stay.patient.firstName} {stay.patient.lastName}
                      <span className="block text-[10px] text-slate-400 font-mono">{stay.patient.ipp}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                          stay.type === "emergency"
                            ? "bg-red-100 text-red-700"
                            : stay.type === "scheduled"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {stay.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {format(new Date(stay.admissionDate), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {stay.dischargeDate
                        ? format(new Date(stay.dischargeDate), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {stay.pmsiCode ? (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-semibold font-mono",
                          stay.pmsiValidated ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        )}>
                          {stay.pmsiCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-semibold",
                          stay.status === "in_progress"
                            ? "text-orange-700 bg-orange-100"
                            : stay.status === "discharged"
                            ? "text-green-700 bg-green-100"
                            : "text-slate-600 bg-slate-100"
                        )}
                      >
                        {stay.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/stays/${stay.id}`);
                        }}
                      >
                        {tc("view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <span>{stays.length} stay(s) total</span>
          <div className="flex gap-4">
            <span className="text-blue-600 font-semibold cursor-pointer">
              {tc("view")} {tc("all")}
            </span>
            <span className="text-blue-600 font-semibold cursor-pointer">{tc("print")}</span>
          </div>
        </div>
      </div>

      {/* New Admission Sheet */}
      <Sheet open={isNewAdmissionOpen} onOpenChange={setIsNewAdmissionOpen}>
        <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <SheetTitle className="text-lg">{t("new_admission")}</SheetTitle>
            <SheetDescription className="text-xs">{t("register_desc")}</SheetDescription>
          </SheetHeader>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {stayError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {stayError}
              </div>
            )}

            {/* Patient */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{tc("patient")}</label>
              <PatientSearchAutocomplete
                className="h-8 text-xs bg-white border-slate-200"
                onSelect={(patient: any) => updateStayForm("patientId", patient.id)}
              />
              <button className="text-xs text-blue-600 hover:underline mt-1 font-medium">
                + {tp("new_patient")}
              </button>
            </div>

            {/* Admission type */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                {t("admission_type")}
              </label>
              <select
                value={stayForm.type}
                onChange={(e) => updateStayForm("type", e.target.value as NewStayForm["type"])}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="emergency">{t("type_emergency")}</option>
                <option value="scheduled">{t("type_scheduled")}</option>
                <option value="day_care">{t("type_day_care")}</option>
                <option value="outpatient">{t("type_outpatient")}</option>
              </select>
            </div>

            {/* Chief complaint */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                {t("chief_complaint")}
              </label>
              <textarea
                value={stayForm.admissionReason}
                onChange={(e) => updateStayForm("admissionReason", e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                placeholder="Patient reports chest pain..."
              />
            </div>

            {/* Department */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                {t("assigned_department")}
              </label>
              <select
                value={stayForm.departmentId}
                onChange={(e) => updateStayForm("departmentId", e.target.value)}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t("unassigned")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Attending Doctor */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                {tc("attending_doctor")}
              </label>
              <select
                value={stayForm.attendingDoctorId}
                onChange={(e) => updateStayForm("attendingDoctorId", e.target.value)}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{tc("unassigned")}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Bed ID (free text until beds API) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Bed ID <span className="text-slate-400 normal-case font-normal">(UUID)</span>
              </label>
              <Input
                value={stayForm.bedId}
                onChange={(e) => updateStayForm("bedId", e.target.value)}
                placeholder="Leave blank if not assigned"
                className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 font-mono"
              />
            </div>
          </div>

          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
            <Button
              variant="outline"
              className="text-xs h-8"
              onClick={() => setIsNewAdmissionOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700"
              onClick={handleSaveStay}
              disabled={savingStay || !stayForm.patientId}
            >
              {savingStay ? "Creating..." : tc("create")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
