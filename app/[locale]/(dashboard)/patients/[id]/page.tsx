"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Edit, FileText, Pill, Activity, MapPin, Phone, User, Calendar, ShieldAlert, Image as ImageIcon, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { format } from "date-fns";

type EmergencyContact = { name?: string; relation?: string; phone?: string };

type EditPatientForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: "M" | "F" | "U";
  nss: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
};

type NewStayForm = {
  type: "emergency" | "scheduled" | "day_care" | "outpatient";
  admissionReason: string;
  departmentId: string;
  bedId: string;
  attendingDoctorId: string;
};

type NewMedRecordForm = {
  type:
    | "consultation"
    | "observation"
    | "surgery_report"
    | "discharge_letter"
    | "referral"
    | "nursing_note"
    | "anesthesia";
  title: string;
  content: string;
  stayId: string;
  authorId: string;
  isSigned: boolean;
};

type Department = { id: string; code: string; name: string; type: string | null };
type Doctor = { id: string; fullName: string; specialty: string | null };

type PatientDetail = {
  id: string;
  ipp: string;
  nss: string | null;
  firstName: string;
  lastName: string;
  gender: "M" | "F" | "U";
  birthDate: string;
  bloodGroup: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  emergencyContact: EmergencyContact | null;
  allergies: string[];
  chronicConditions: string[];
  isDeceased: boolean;
};

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
  departmentId: string | null;
  bedId: string | null;
  attendingDoctorId: string | null;
};

type PrescriptionItem = { drug?: string; name?: string; dose?: string; frequency?: string; [k: string]: unknown };

type PrescriptionRow = {
  id: string;
  status: string;
  prescribedAt: string;
  items: PrescriptionItem[] | unknown;
  prescriberId: string;
  drugDispensings?: { id: string; dispensedAt: string }[];
};

type ExamResult = { id: string; resultData: unknown; isCritical: boolean; createdAt: string };

type ExamRow = {
  id: string;
  type: string;
  examCode: string;
  examLabel: string;
  status: string;
  requestedAt: string;
  results: ExamResult[];
};

type MedicalRecordRow = {
  id: string;
  type: string;
  title: string | null;
  content: string;
  isSigned: boolean;
  signedAt: string | null;
  createdAt: string;
  stay?: {
    stayNumber: string;
    type: string;
    admissionDate: string;
  } | null;
};

type BillingRow = {
  id: string;
  status: string;
  totalAmount: string;
  insuranceAmount: string;
  patientAmount: string;
  paidAmount: string;
  pmsiCode: string | null;
  createdAt: string;
  stay?: {
    stayNumber: string;
    admissionDate: string;
    dischargeDate: string | null;
  } | null;
};

function ageFromBirthDate(iso: string): number {
  const b = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function genderLabel(g: "M" | "F" | "U"): string {
  if (g === "M") return "Male";
  if (g === "F") return "Female";
  return "Other";
}

function stayTypeLabel(t: string, tc: ReturnType<typeof useTranslations>): string {
  if (t === "emergency") return tc("status_emergency");
  if (t === "scheduled") return tc("status_scheduled");
  return t;
}

function stayStatusLabel(s: string, tc: ReturnType<typeof useTranslations>): string {
  if (s === "in_progress") return tc("status_in_progress");
  if (s === "discharged") return tc("status_discharged");
  return s;
}

function describePrescription(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return (items as PrescriptionItem[])
    .map((it) => {
      const name = it.drug ?? it.name ?? "Item";
      const dose = it.dose ? ` ${it.dose}` : "";
      const freq = it.frequency ? ` - ${it.frequency}` : "";
      return `${name}${dose}${freq}`;
    })
    .join(", ");
}

export default function PatientDetailPage() {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const trec = useTranslations('record');
  const tad = useTranslations('admissions');
  const trx = useTranslations('pharmacy');
  const trad = useTranslations('radiology');
  const params = useParams();
  const id = params.id as string;

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [stays, setStays] = useState<StayRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [records, setRecords] = useState<MedicalRecordRow[]>([]);
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference data for dropdowns
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Medical record form state
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<NewMedRecordForm>({
    type: "consultation",
    title: "",
    content: "",
    stayId: "",
    authorId: "00000000-0000-0000-0000-000000000001",
    isSigned: false,
  });
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditPatientForm>({
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "M",
    nss: "",
    bloodGroup: "",
    phone: "",
    email: "",
    address: "",
    emergencyName: "",
    emergencyRelation: "",
    emergencyPhone: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isStayOpen, setIsStayOpen] = useState(false);
  const [stayForm, setStayForm] = useState<NewStayForm>({
    type: "emergency",
    admissionReason: "",
    departmentId: "",
    bedId: "",
    attendingDoctorId: "",
  });
  const [savingStay, setSavingStay] = useState(false);
  const [stayError, setStayError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pRes, sRes, rxRes, exRes, recRes, billRes] = await Promise.all([
          fetch(`/api/v1/patients/${id}`),
          fetch(`/api/v1/patients/${id}/stays`),
          fetch(`/api/v1/patients/${id}/prescriptions`),
          fetch(`/api/v1/patients/${id}/exams`),
          fetch(`/api/v1/patients/${id}/records`),
          fetch(`/api/v1/patients/${id}/billing`),
        ]);
        const [pJson, sJson, rxJson, exJson, recJson, billJson] = await Promise.all([
          pRes.json(),
          sRes.json(),
          rxRes.json(),
          exRes.json(),
          recRes.json(),
          billRes.json(),
        ]);
        if (cancelled) return;
        if (!pRes.ok || !pJson.success) throw new Error(pJson.error ?? "Failed to load patient");
        setPatient(pJson.data as PatientDetail);
        if (sJson.success) setStays(sJson.data as StayRow[]);
        if (rxJson.success) setPrescriptions(rxJson.data as PrescriptionRow[]);
        if (exJson.success) setExams(exJson.data as ExamRow[]);
        if (recJson.success) setRecords(recJson.data as MedicalRecordRow[]);
        if (billJson.success) setBilling(billJson.data as BillingRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Load reference data for dropdowns
    Promise.all([
      fetch("/api/v1/departments").then((r) => r.json()),
      fetch("/api/v1/doctors").then((r) => r.json()),
    ]).then(([deptJson, docJson]) => {
      if (deptJson.success) setDepartments(deptJson.data as Department[]);
      if (docJson.success) setDoctors(docJson.data as Doctor[]);
    });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-500">Loading…</div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Patient not found</h2>
          <p className="mt-2 text-sm text-slate-500">{error ?? "The requested patient does not exist."}</p>
          <Link href="/patients" className="mt-4 inline-block text-blue-600 text-xs underline">Back to directory</Link>
        </div>
      </div>
    );
  }

  const allergies = Array.isArray(patient.allergies) ? patient.allergies : [];
  const chronic = Array.isArray(patient.chronicConditions) ? patient.chronicConditions : [];
  const ec = patient.emergencyContact ?? {};

  const updateEditForm = <K extends keyof EditPatientForm>(key: K, value: EditPatientForm[K]) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const openEditSheet = () => {
    setEditForm({
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate,
      gender: patient.gender,
      nss: patient.nss || "",
      bloodGroup: patient.bloodGroup || "",
      phone: patient.phone || "",
      email: patient.email || "",
      address: patient.address || "",
      emergencyName: ec.name || "",
      emergencyRelation: ec.relation || "",
      emergencyPhone: ec.phone || "",
    });
    setSaveError(null);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        birthDate: editForm.birthDate,
        gender: editForm.gender,
        nss: editForm.nss || null,
        bloodGroup: editForm.bloodGroup || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        address: editForm.address || null,
        emergencyContact:
          editForm.emergencyName || editForm.emergencyPhone
            ? {
                name: editForm.emergencyName,
                relation: editForm.emergencyRelation,
                phone: editForm.emergencyPhone,
              }
            : {},
      };
      const res = await fetch(`/api/v1/patients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to save");
      setIsEditOpen(false);
      // Reload patient data
      const pRes = await fetch(`/api/v1/patients/${id}`);
      const pJson = await pRes.json();
      if (pJson.success) setPatient(pJson.data as PatientDetail);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save patient");
    } finally {
      setSaving(false);
    }
  };

  const updateStayForm = <K extends keyof NewStayForm>(key: K, value: NewStayForm[K]) => {
    setStayForm((prev) => ({ ...prev, [key]: value }));
  };

  const openStaySheet = () => {
    setStayForm({
      type: "emergency",
      admissionReason: "",
      departmentId: "",
      bedId: "",
      attendingDoctorId: "",
    });
    setStayError(null);
    setIsStayOpen(true);
  };

  const handleSaveStay = async () => {
    if (savingStay) return;
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
      const res = await fetch(`/api/v1/patients/${id}/stays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to create stay");
      setIsStayOpen(false);
      // Reload stays data
      const sRes = await fetch(`/api/v1/patients/${id}/stays`);
      const sJson = await sRes.json();
      if (sJson.success) setStays(sJson.data as StayRow[]);
    } catch (e) {
      setStayError(e instanceof Error ? e.message : "Failed to create stay");
    } finally {
      setSavingStay(false);
    }
  };

  // ── Medical Record form helpers ──────────────────────────────────────────
  const updateRecordForm = <K extends keyof NewMedRecordForm>(key: K, value: NewMedRecordForm[K]) => {
    setRecordForm((prev) => ({ ...prev, [key]: value }));
  };

  const openRecordSheet = () => {
    setRecordForm({
      type: "consultation",
      title: "",
      content: "",
      stayId: "",
      authorId: "00000000-0000-0000-0000-000000000001",
      isSigned: false,
    });
    setRecordError(null);
    setIsRecordOpen(true);
  };

  const handleSaveRecord = async () => {
    if (savingRecord) return;
    setSavingRecord(true);
    setRecordError(null);
    try {
      const payload = {
        authorId: recordForm.authorId,
        type: recordForm.type,
        title: recordForm.title || null,
        content: recordForm.content,
        stayId: recordForm.stayId || null,
        isSigned: recordForm.isSigned,
      };
      const res = await fetch(`/api/v1/patients/${id}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to create record");
      setIsRecordOpen(false);
      // Reload records
      const recRes = await fetch(`/api/v1/patients/${id}/records`);
      const recJson = await recRes.json();
      if (recJson.success) setRecords(recJson.data as MedicalRecordRow[]);
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : "Failed to create record");
    } finally {
      setSavingRecord(false);
    }
  };

  const age = ageFromBirthDate(patient.birthDate);
  const dobLabel = `${format(new Date(patient.birthDate), "yyyy-MM-dd")} (${age} y.o.)`;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/patients" className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 text-slate-500 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{patient.firstName} {patient.lastName}</h1>
              <span className={cn(
                  "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                  patient.isDeceased ? "bg-slate-200 text-slate-700" : "bg-green-100 text-green-700"
              )}>
                {patient.isDeceased ? "Deceased" : tc('status_active')}
              </span>
              {allergies.length > 0 && (
                 <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded uppercase font-semibold flex items-center gap-1">
                   <ShieldAlert className="h-3 w-3" /> {t('allergies')}
                 </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span className="font-mono">IPP: {patient.ipp}</span>
              {patient.nss && <><span>&bull;</span><span>NSS: <span className="font-mono">{patient.nss}</span></span></>}
              <span>&bull;</span>
              <span>{dobLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="text-xs h-8 text-slate-600" onClick={openEditSheet}>
             <Edit className="mr-2 h-3 w-3" />
             {tc('edit')}
           </Button>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs" onClick={openStaySheet}>
             {tc('new_admission')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Left Column: Quick Profile */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">{t('demographics')}</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><User className="h-3 w-3" /> {tc('gender')} & {t('blood_group')}</div>
                <div className="text-xs font-semibold text-slate-900">{genderLabel(patient.gender)}, {patient.bloodGroup ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {tc('address')}</div>
                <div className="text-xs font-semibold text-slate-900">{patient.address ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /> {t('contact_info')}</div>
                <div className="text-xs font-semibold text-slate-900">{patient.phone ?? "—"}</div>
                <div className="text-xs text-slate-600">{patient.email ?? ""}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">{t('emergency_contact')}</div>
            <div className="space-y-3">
              <div>
                {ec.name || ec.phone ? (
                  <>
                    <div className="text-xs font-semibold text-slate-900">{ec.name ?? "—"}{ec.relation ? ` (${ec.relation})` : ""}</div>
                    <div className="text-xs text-blue-600 mt-0.5">{ec.phone ?? ""}</div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 italic">Not provided</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded border border-slate-800 shadow-sm p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t('clinical_alerts')}</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 mb-1 uppercase">{t('allergies')}</div>
                <div className="flex flex-wrap gap-1">
                  {allergies.length === 0 && <span className="text-[10px] text-slate-500 italic">None</span>}
                  {allergies.map((a) => (
                    <span key={a} className="px-2 py-0.5 bg-red-900/50 text-red-400 border border-red-800 rounded text-[10px] font-semibold">{a}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-1 uppercase">{t('chronic_conditions')}</div>
                <div className="flex flex-wrap gap-1">
                  {chronic.length === 0 && <span className="text-[10px] text-slate-500 italic">None</span>}
                  {chronic.map((c) => (
                    <span key={c} className="px-2 py-0.5 bg-blue-900/50 text-blue-400 border border-blue-800 rounded text-[10px] font-semibold">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-tab content */}
        <div className="col-span-9 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <Tabs defaultValue="admissions" className="w-full flex-1 flex flex-col">
            <div className="px-2 pt-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <TabsList className="h-9 bg-transparent p-0 flex justify-start gap-4">
                <TabsTrigger 
                  value="admissions" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Calendar className="h-3.5 w-3.5 mr-2" /> {t('admissions_stays')}
                </TabsTrigger>
                <TabsTrigger 
                  value="records" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <FileText className="h-3.5 w-3.5 mr-2" /> {t('medical_records')}
                </TabsTrigger>
                <TabsTrigger 
                  value="prescriptions" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Pill className="h-3.5 w-3.5 mr-2" /> {trx('queue_tab')}
                </TabsTrigger>
                <TabsTrigger 
                  value="labs" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Activity className="h-3.5 w-3.5 mr-2" /> {tc('laboratory')}
                </TabsTrigger>
                <TabsTrigger 
                  value="imaging" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <ImageIcon className="h-3.5 w-3.5 mr-2" /> {tc('radiology')}
                </TabsTrigger>
                <TabsTrigger 
                  value="billing" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <CreditCard className="h-3.5 w-3.5 mr-2" /> {tc('billing')}
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-auto bg-white p-0">
              <TabsContent value="admissions" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">{tc('stay_id')}</th>
                      <th className="px-4 py-2">{tc('admission_date')}</th>
                      <th className="px-4 py-2">{tc('type')}</th>
                      <th className="px-4 py-2">{tc('discharge_date')}</th>
                      <th className="px-4 py-2">PMSI</th>
                      <th className="px-4 py-2">{tc('dept_bed')}</th>
                      <th className="px-4 py-2">{tc('doctor')}</th>
                      <th className="px-4 py-2">{tc('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {stays.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500 italic">{t('no_admissions')}</td></tr>
                    )}
                    {stays.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-3 font-mono text-slate-600">{adm.stayNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{format(new Date(adm.admissionDate), "MMM d, yyyy HH:mm")}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                            adm.type === 'emergency' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")}>
                            {stayTypeLabel(adm.type, tc)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {adm.dischargeDate ? format(new Date(adm.dischargeDate), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {adm.pmsiCode ? (
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-semibold font-mono",
                              adm.pmsiValidated ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            )}>
                              {adm.pmsiCode}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{adm.departmentId ?? "—"} <span className="text-slate-500 block text-[10px]">{adm.bedId ?? ""}</span></td>
                        <td className="px-4 py-3">{adm.attendingDoctorId ?? "—"}</td>
                        <td className="px-4 py-3">
                           <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                            adm.status === 'in_progress' ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700")}>
                             {stayStatusLabel(adm.status, tc)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="records" className="m-0 border-none outline-none">
                <div className="flex justify-end p-2 border-b border-slate-100">
                  <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={openRecordSheet}>
                    + {t('add_medical_record')}
                  </Button>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">{tc('date')}</th>
                      <th className="px-4 py-2">{tc('type')}</th>
                      <th className="px-4 py-2">{tc('title')}</th>
                      <th className="px-4 py-2">{tc('stay')}</th>
                      <th className="px-4 py-2">{tc('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {records.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_medical_records')}</td></tr>
                    )}
                    {records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-3 font-medium text-slate-900">{format(new Date(rec.createdAt), "MMM d, yyyy HH:mm")}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-100 text-slate-700">
                            {rec.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">{rec.title || '—'}</td>
                        <td className="px-4 py-3">{rec.stay?.stayNumber || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                            rec.isSigned ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                            {rec.isSigned ? tc('signed') : tc('unsigned')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="prescriptions" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">{tc('date_prescribed')}</th>
                      <th className="px-4 py-2">{tc('medication')}</th>
                      <th className="px-4 py-2">{trx('prescriber')}</th>
                      <th className="px-4 py-2">{tc('status')}</th>
                      <th className="px-4 py-2 text-right">{tc('dispense_history')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {prescriptions.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_prescriptions')}</td></tr>
                    )}
                    {prescriptions.map((rx) => {
                      const lastDispense = rx.drugDispensings?.[0];
                      return (
                        <tr key={rx.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">
                            <div>{format(new Date(rx.prescribedAt), "MMM d, yyyy")}</div>
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5">{rx.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-900 font-medium">{describePrescription(rx.items)}</td>
                          <td className="px-4 py-3 text-slate-600">{rx.prescriberId}</td>
                          <td className="px-4 py-3">
                             <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                              rx.status === 'validated' ? "bg-blue-100 text-blue-700" :
                              rx.status === 'dispensed' ? "bg-green-100 text-green-700" :
                              "bg-slate-100 text-slate-700")}>
                              {rx.status}
                             </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                             {lastDispense ? (
                               <div className="text-[10px] text-slate-500">
                                 <span className="text-green-600 font-semibold mb-0.5 block">{tc('dispensed_on')} {format(new Date(lastDispense.dispensedAt), "MMM d, yyyy")}</span>
                               </div>
                             ) : (
                               <span className="text-slate-400 text-[10px] italic">{t('awaiting_dispense')}</span>
                             )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="labs" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">{tc('test_id')}</th>
                      <th className="px-4 py-2">{tc('date')}</th>
                      <th className="px-4 py-2">{tc('panel_assay')}</th>
                      <th className="px-4 py-2">{tc('status')}</th>
                      <th className="px-4 py-2 text-right">{tc('result')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {exams.filter((e) => e.type === 'biology').length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_laboratory_tests')}</td></tr>
                    )}
                    {exams.filter((e) => e.type === 'biology').map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-600">{e.examCode}</td>
                        <td className="px-4 py-3 text-slate-600">{format(new Date(e.requestedAt), "MMM d, yyyy")}</td>
                        <td className="px-4 py-3 text-slate-900">{e.examLabel}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                            e.results.length > 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                            {e.results.length > 0 ? tc('status_final') : e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {e.results.length > 0 ? (
                            <button className="text-blue-600 hover:underline">{tc('view')}</button>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">{t('pending')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="imaging" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">{tc('scan_id')}</th>
                      <th className="px-4 py-2">{tc('date')}</th>
                      <th className="px-4 py-2">{trad('modality') || "Modality"}</th> 
                      <th className="px-4 py-2">{trad('region') || "Region"}</th>
                      <th className="px-4 py-2 text-right">{tc('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {exams.filter((e) => e.type === 'radiology').length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_imaging_studies')}</td></tr>
                    )}
                    {exams.filter((e) => e.type === 'radiology').map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-600">{e.examCode}</td>
                        <td className="px-4 py-3 text-slate-600">{format(new Date(e.requestedAt), "MMM d, yyyy")}</td>
                        <td className="px-4 py-3 font-semibold">{e.examCode}</td>
                        <td className="px-4 py-3 text-slate-900">{e.examLabel}</td>
                        <td className="px-4 py-3 text-right"><button className="text-blue-600 hover:underline">{t('open_viewer')}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="billing" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">{tc('stay_id')}</th>
                      <th className="px-4 py-2">{tc('date_generated')}</th>
                      <th className="px-4 py-2">{tc('amount')}</th>
                      <th className="px-4 py-2">{tc('coverage')}</th>
                      <th className="px-4 py-2">{tc('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {billing.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_billing_records')}</td></tr>
                    )}
                    {billing.map((bill) => (
                      <tr key={bill.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-600">{bill.stay?.stayNumber || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{format(new Date(bill.createdAt), "MMM d, yyyy")}</td>
                        <td className="px-4 py-3 font-medium">{bill.totalAmount}</td>
                        <td className="px-4 py-3 text-slate-600">{bill.insuranceAmount}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                            bill.status === 'paid' ? "bg-green-100 text-green-700" : 
                            bill.status === 'billed' ? "bg-blue-100 text-blue-700" : 
                            "bg-yellow-100 text-yellow-700")}>
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <SheetTitle className="text-lg">{t('edit_patient')}</SheetTitle>
            <SheetDescription className="text-xs">
              {t('edit_desc')}
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
                   <Input value={editForm.firstName} onChange={(e) => updateEditForm("firstName", e.target.value)} placeholder="eg. John" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('last_name')} *</label>
                   <Input value={editForm.lastName} onChange={(e) => updateEditForm("lastName", e.target.value)} placeholder="eg. Doe" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('dob')} *</label>
                   <Input type="date" value={editForm.birthDate} onChange={(e) => updateEditForm("birthDate", e.target.value)} className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 text-slate-700" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('gender')} *</label>
                   <select
                     value={editForm.gender}
                     onChange={(e) => updateEditForm("gender", e.target.value as EditPatientForm["gender"])}
                     className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                   >
                      <option value="M">{t('gender_male')}</option>
                      <option value="F">{t('gender_female')}</option>
                      <option value="U">{t('gender_other')}</option>
                   </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('ssn')}</label>
                   <Input value={editForm.nss} onChange={(e) => updateEditForm("nss", e.target.value)} placeholder="Optional" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 font-mono" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('blood_group')}</label>
                   <select
                     value={editForm.bloodGroup}
                     onChange={(e) => updateEditForm("bloodGroup", e.target.value)}
                     className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                   >
                      <option value="">Unknown</option>
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
                 <Input type="tel" value={editForm.phone} onChange={(e) => updateEditForm("phone", e.target.value)} placeholder="+237 6..." className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('email')}</label>
                 <Input type="email" value={editForm.email} onChange={(e) => updateEditForm("email", e.target.value)} placeholder="patient@example.com" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('address')}</label>
                 <textarea
                    value={editForm.address}
                    onChange={(e) => updateEditForm("address", e.target.value)}
                    className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                    placeholder="Quartier, Ville, Pays"
                 />
               </div>
             </div>

             {/* Emergency Contact */}
             <div className="space-y-3">
               <h4 className="text-[11px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">{t('emergency_contact')}</h4>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('name')}</label>
                   <Input value={editForm.emergencyName} onChange={(e) => updateEditForm("emergencyName", e.target.value)} placeholder="Contact Name" className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">{t('relationship')}</label>
                   <select
                     value={editForm.emergencyRelation}
                     onChange={(e) => updateEditForm("emergencyRelation", e.target.value)}
                     className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                   >
                      <option value="">Select...</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Other">Other</option>
                   </select>
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">{tc('phone')}</label>
                 <Input type="tel" value={editForm.emergencyPhone} onChange={(e) => updateEditForm("emergencyPhone", e.target.value)} placeholder="+237 6..." className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400" />
               </div>
             </div>
          </div>
          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <Button variant="outline" className="text-xs h-8" onClick={() => setIsEditOpen(false)} disabled={saving}>{tc('cancel')}</Button>
            <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : tad('new_admission')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isStayOpen} onOpenChange={setIsStayOpen}>
        <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <SheetTitle className="text-lg">{tc('new_admission')}</SheetTitle>
            <SheetDescription className="text-xs">
              {t('new_admission_desc')}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
             {stayError && (
               <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{stayError}</div>
             )}
             
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">{tad('patient')}</label>
               <div className="h-8 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700">
                 {patient.firstName} {patient.lastName} ({patient.ipp})
               </div>
             </div>
             
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">{t('admission_type')}</label>
               <select
                 value={stayForm.type}
                 onChange={(e) => updateStayForm("type", e.target.value as NewStayForm["type"])}
                 className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-400"
               >
                  <option value="emergency">{t('type_emergency')}</option>
                  <option value="scheduled">{t('type_scheduled')}</option>
                  <option value="day_care">{t('type_day_care')}</option>
                  <option value="outpatient">{t('type_outpatient')}</option>
               </select>
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">{t('chief_complaint')}</label>
               <textarea 
                  value={stayForm.admissionReason}
                  onChange={(e) => updateStayForm("admissionReason", e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                  placeholder="Patient reports chest pain..."
               />
             </div>
             
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">{t('assigned_department')}</label>
               <select
                 value={stayForm.departmentId}
                 onChange={(e) => updateStayForm("departmentId", e.target.value)}
                 className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
               >
                 <option value="">{t('unassigned')}</option>
                 {departments.map((d) => (
                   <option key={d.id} value={d.id}>
                     {d.name} ({d.code})
                   </option>
                 ))}
               </select>
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase">{tad('attending_doctor')}</label>
               <select
                 value={stayForm.attendingDoctorId}
                 onChange={(e) => updateStayForm("attendingDoctorId", e.target.value)}
                 className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
               >
                 <option value="">{tad('unassigned')}</option>
                 {doctors.map((d) => (
                   <option key={d.id} value={d.id}>
                     Dr. {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}
                   </option>
                 ))}
               </select>
             </div>

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
          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <Button variant="outline" className="text-xs h-8" onClick={() => setIsStayOpen(false)} disabled={savingStay}>{tc('cancel')}</Button>
            <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={handleSaveStay} disabled={savingStay}>
              {savingStay ? "Creating..." : tc('save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <SheetContent className="sm:max-w-md w-full right-0 p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <SheetTitle className="text-lg">{trec('new_medical_record')}</SheetTitle>
            <SheetDescription className="text-xs">
              {trec('new_medical_record_desc')}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {recordError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{recordError}</div>
            )}
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{trec('record_type')}</label>
              <select
                value={recordForm.type}
                onChange={(e) => updateRecordForm("type", e.target.value as NewMedRecordForm["type"])}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="consultation">Consultation</option>
                <option value="observation">Observation</option>
                <option value="surgery_report">Surgery Report</option>
                <option value="discharge_letter">Discharge Letter</option>
                <option value="referral">Referral</option>
                <option value="nursing_note">Nursing Note</option>
                <option value="anesthesia">Anesthesia</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{trec('record_title')}</label>
              <Input
                value={recordForm.title}
                onChange={(e) => updateRecordForm("title", e.target.value)}
                placeholder="e.g., Follow-up Consultation"
                className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{trec('record_content')}</label>
              <textarea
                value={recordForm.content}
                onChange={(e) => updateRecordForm("content", e.target.value)}
                className="flex min-h-[150px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                placeholder="Clinical notes..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{trec('link_to_stay')}</label>
              <select
                value={recordForm.stayId}
                onChange={(e) => updateRecordForm("stayId", e.target.value)}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">None</option>
                {stays.map(s => (
                  <option key={s.id} value={s.id}>{s.stayNumber} ({format(new Date(s.admissionDate), "MMM d, yyyy")})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{trec('author_uuid')}</label>
              <Input
                value={recordForm.authorId}
                onChange={(e) => updateRecordForm("authorId", e.target.value)}
                className="h-8 text-xs bg-white border-slate-200 focus:border-blue-400 font-mono"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="isSigned"
                checked={recordForm.isSigned}
                onChange={(e) => updateRecordForm("isSigned", e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isSigned" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {trec('sign_record')}
              </label>
            </div>
          </div>
          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <Button variant="outline" className="text-xs h-8" onClick={() => setIsRecordOpen(false)} disabled={savingRecord}>{tc('cancel')}</Button>
            <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={handleSaveRecord} disabled={savingRecord || !recordForm.content || !recordForm.authorId}>
              {savingRecord ? "Saving..." : trec('save_record')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
