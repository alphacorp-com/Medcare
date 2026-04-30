"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Search, Filter, UserPlus, Printer, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { useTranslations } from "next-intl";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";

type PatientRow = {
  id: string;
  ipp: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F" | "U";
  birthDate: string;
  bloodGroup: string | null;
  phone: string | null;
  email: string | null;
  isDeceased: boolean;
  createdAt: string;
};

type NewPatientForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: "" | "M" | "F" | "U";
  nss: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
};

const EMPTY_FORM: NewPatientForm = {
  firstName: "",
  lastName: "",
  birthDate: "",
  gender: "",
  nss: "",
  bloodGroup: "",
  phone: "",
  email: "",
  address: "",
  emergencyName: "",
  emergencyRelation: "",
  emergencyPhone: "",
};

function ageFromBirthDate(iso: string): number {
  const b = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export default function PatientsPage() {
  const hasModule = useAppStore((state) => state.hasModule);
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const tDocs = useTranslations('documents');
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<any>(null);

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "deceased">("active");
  const [pendingStatus, setPendingStatus] = useState<"active" | "deceased">("active");

  const [form, setForm] = useState<NewPatientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounce the search input
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/v1/patients", window.location.origin);
      if (searchQuery) url.searchParams.set("q", searchQuery);
      url.searchParams.set("status", statusFilter);
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load");
      setPatients(json.data as PatientRow[]);
      setTotal(json.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error_load'));
      setPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, t]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleExportPDF = () => {
    const data = {
      title: tDocs('patient_list'),
      department: t('title'),
      date: format(new Date(), "yyyy-MM-dd"),
      patients: patients.map(p => ({
        ipp: p.ipp,
        name: `${p.lastName} ${p.firstName}`,
        gender: p.gender,
        age: `${ageFromBirthDate(p.birthDate)}`,
        status: p.isDeceased ? t('status_deceased') : tc('status_active')
      }))
    };
    setPdfData(data);
    setIsPreviewOpen(true);
  };

  const applyFilters = () => {
    setStatusFilter(pendingStatus);
  };

  const clearFilters = () => {
    setPendingStatus("active");
    setStatusFilter("active");
    setShowFilters(false);
  };

  const updateForm = <K extends keyof NewPatientForm>(key: K, value: NewPatientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = useMemo(
    () => form.firstName && form.lastName && form.birthDate && form.gender,
    [form],
  );

  const handleSave = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        birthDate: form.birthDate,
        gender: form.gender,
        nss: form.nss || null,
        bloodGroup: form.bloodGroup || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        emergencyContact:
          form.emergencyName || form.emergencyPhone
            ? {
              name: form.emergencyName,
              relation: form.emergencyRelation,
              phone: form.emergencyPhone,
            }
            : {},
      };
      const res = await fetch("/api/v1/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      setIsNewPatientOpen(false);
      setForm(EMPTY_FORM);
      await fetchPatients();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('error_save_patient'));
    } finally {
      setSaving(false);
    }
  };

  if (!hasModule('MODULE_CORE_PATIENT')) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tc('restricted_access')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('module_desc')}</p>
          <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
            {tc('contact_admin')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportPDF}><Download className="h-3.5 w-3.5 mr-2" /> {tc('export')}</Button>
          <Button variant="outline" size="sm" className="text-xs h-8 text-slate-700" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-3 w-3" />
            {t('advanced_filters')}
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={() => setIsNewPatientOpen(true)}>
            <UserPlus className="mr-2 h-3 w-3" />
            {t('new_patient')}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
          <div className="flex items-center">
            <div className="relative w-96">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('search_placeholder')}
                className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
              />
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 pt-2 mt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('status')}:</label>
                <select
                  value={pendingStatus}
                  onChange={(e) => setPendingStatus(e.target.value as "active" | "deceased")}
                  className="h-7 text-xs bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 text-slate-700"
                >
                  <option value="active">{tc('status_active')}</option>
                  <option value="deceased">{t('status_deceased')}</option>
                </select>
              </div>
              <Button size="sm" variant="secondary" className="h-7 text-xs ml-auto" onClick={applyFilters}>{t('apply_filters')}</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={clearFilters}>{t('clear')}</Button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{tc('ipp')}</th>
                <th className="px-4 py-2">{tc('name')}</th>
                <th className="px-4 py-2">{tc('gender')}</th>
                <th className="px-4 py-2">{tc('dob')}</th>
                <th className="px-4 py-2">{tc('status')}</th>
                <th className="px-4 py-2 text-right">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {loading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded w-40" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded w-6" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded w-10 ml-auto" /></td>
                  </tr>
                ))
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-red-600 text-xs">{error}</td>
                </tr>
              )}
              {!loading && !error && patients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                    {t('no_patients_found')}
                  </td>
                </tr>
              )}
              {!loading && !error && patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-blue-50/50 cursor-pointer"
                  onClick={() => router.push(`/patients/${patient.id}`)}
                >
                  <td className="px-4 py-2 font-mono text-slate-600">{patient.ipp}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{patient.lastName} {patient.firstName}</td>
                  <td className="px-4 py-2">{patient.gender}</td>
                  <td className="px-4 py-2">
                    {format(new Date(patient.birthDate), "yyyy-MM-dd")}
                    <span className="text-slate-400 ml-1">({t('age_years', { age: ageFromBirthDate(patient.birthDate) })})</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                      patient.isDeceased ? "bg-slate-200 text-slate-700" : "bg-green-100 text-green-700"
                    )}>
                      {patient.isDeceased ? t('status_deceased') : tc('status_active')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/patients/${patient.id}`);
                      }}
                    >
                      {tc('view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <span>{t('showing_total', { count: total })}</span>
        </div>
      </div>

      <Sheet open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <SheetTitle className="text-lg">{t('register_title')}</SheetTitle>
            <SheetDescription className="text-xs">
              {t('register_desc')}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 flex-1 overflow-y-auto space-y-6">
            {saveError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{saveError}</div>
            )}
            {/* Demographics */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('demographics')}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('first_name')} *</label>
                  <Input value={form.firstName} onChange={(e) => updateForm("firstName", e.target.value)} placeholder={t('placeholder_first_name')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('last_name')} *</label>
                  <Input value={form.lastName} onChange={(e) => updateForm("lastName", e.target.value)} placeholder={t('placeholder_last_name')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('dob')} *</label>
                  <Input type="date" value={form.birthDate} onChange={(e) => updateForm("birthDate", e.target.value)} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 text-slate-700" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('gender')} *</label>
                  <select
                    value={form.gender}
                    onChange={(e) => updateForm("gender", e.target.value as NewPatientForm["gender"])}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">{tc('select_placeholder')}</option>
                    <option value="M">{t('gender_male')}</option>
                    <option value="F">{t('gender_female')}</option>
                    <option value="U">{t('gender_other')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('ssn')}</label>
                  <Input value={form.nss} onChange={(e) => updateForm("nss", e.target.value)} placeholder={t('placeholder_nss')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('blood_group')}</label>
                  <select
                    value={form.bloodGroup}
                    onChange={(e) => updateForm("bloodGroup", e.target.value)}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">{tc('unknown')}</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('contact_info')}</h4>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
                <Input type="tel" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} placeholder={t('placeholder_phone')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('email')}</label>
                <Input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} placeholder={t('placeholder_email')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('address')}</label>
                <textarea
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                  className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                  placeholder={t('placeholder_address')}
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('emergency_contact')}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('name')}</label>
                  <Input value={form.emergencyName} onChange={(e) => updateForm("emergencyName", e.target.value)} placeholder={t('placeholder_contact_name')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('relationship')}</label>
                  <select
                    value={form.emergencyRelation}
                    onChange={(e) => updateForm("emergencyRelation", e.target.value)}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">{tc('select_placeholder')}</option>
                    <option value="Spouse">{t('relation_spouse')}</option>
                    <option value="Child">{t('relation_child')}</option>
                    <option value="Parent">{t('relation_parent')}</option>
                    <option value="Sibling">{t('relation_sibling')}</option>
                    <option value="Other">{t('relation_other')}</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
                <Input type="tel" value={form.emergencyPhone} onChange={(e) => updateForm("emergencyPhone", e.target.value)} placeholder={t('placeholder_phone')} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
              </div>
            </div>
          </div>
          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <Button variant="outline" className="text-xs h-8" onClick={() => setIsNewPatientOpen(false)} disabled={saving}>{tc('cancel')}</Button>
            <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={!canSubmit || saving}>
              {saving ? tc('saving') : t('save_record')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        templateId="patient_lists"
        data={pdfData}
        facility={{ name: tc('hospital_name') }}
        settings={{ watermark: true }}
      />
    </div>
  );
}
