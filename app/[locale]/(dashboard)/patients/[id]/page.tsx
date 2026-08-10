"use client";

import { Link } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import { EMPTY_VITALS } from "@/components/shared/vitals-fields";
import { notifyBillingGenerated } from "@/lib/billing/client";

// Internal Components
import { PatientDetailHeader } from "./_components/PatientDetailHeader";
import { PatientQuickProfile } from "./_components/PatientQuickProfile";
import { PatientTabs } from "./_components/PatientTabs";
import { 
  EditPatientSheet, 
  NewAdmissionSheet, 
  NewMedicalRecordSheet 
} from "./_components/PatientActionSheets";

// Types
import {
  PatientDetail,
  StayRow,
  PrescriptionRow,
  ExamRow,
  MedicalRecordRow,
  BillingRow,
  VitalSignsRow,
  SurgeryRow,
  PregnancyRow,
  Department,
  Doctor,
  Bed,
  EditPatientForm,
  NewStayForm,
  NewMedRecordForm
} from "./types";

export default function PatientDetailPage() {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();

  // Data State
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [stays, setStays] = useState<StayRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [records, setRecords] = useState<MedicalRecordRow[]>([]);
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [vitals, setVitals] = useState<VitalSignsRow[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryRow[]>([]);
  const [pregnancies, setPregnancies] = useState<PregnancyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);

  // UI State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStayOpen, setIsStayOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<any>(null);

  // Form States
  const [editForm, setEditForm] = useState<EditPatientForm>({
    firstName: "", lastName: "", birthDate: "", gender: "M", nss: "", bloodGroup: "",
    phone: "", email: "", address: "", emergencyName: "", emergencyRelation: "", emergencyPhone: ""
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [stayForm, setStayForm] = useState<NewStayForm>({
    type: "emergency", admissionReason: "", departmentId: "", bedId: "", attendingDoctorId: "", vitals: EMPTY_VITALS
  });
  const [savingStay, setSavingStay] = useState(false);
  const [stayError, setStayError] = useState<string | null>(null);

  const [recordForm, setRecordForm] = useState<NewMedRecordForm>({
    type: "consultation", title: "", content: "", stayId: "", authorId: "", isSigned: false
  });
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [pRes, sRes, rxRes, exRes, recRes, billRes, vitRes, surgRes, pregRes] = await Promise.all([
        fetch(`/api/v1/patients/${id}`),
        fetch(`/api/v1/patients/${id}/stays`),
        fetch(`/api/v1/patients/${id}/prescriptions`),
        fetch(`/api/v1/patients/${id}/exams`),
        fetch(`/api/v1/patients/${id}/records`),
        fetch(`/api/v1/patients/${id}/billing`),
        fetch(`/api/v1/patients/${id}/vitals`),
        fetch(`/api/v1/patients/${id}/surgeries`),
        fetch(`/api/v1/patients/${id}/pregnancies`),
      ]);
      const [pJson, sJson, rxJson, exJson, recJson, billJson, vitJson, surgJson, pregJson] = await Promise.all([
        pRes.json(), sRes.json(), rxRes.json(), exRes.json(), recRes.json(), billRes.json(), vitRes.json(), surgRes.json(), pregRes.json()
      ]);

      if (!pRes.ok || !pJson.success) throw new Error(pJson.error ?? "Failed to load patient");
      setPatient(pJson.data);
      if (sJson.success) setStays(sJson.data);
      if (rxJson.success) setPrescriptions(rxJson.data);
      if (exJson.success) setExams(exJson.data);
      if (recJson.success) setRecords(recJson.data);
      if (billJson.success) setBilling(billJson.data);
      if (vitJson.success) setVitals(vitJson.data);
      if (surgJson.success) setSurgeries(surgJson.data);
      if (pregJson.success) setPregnancies(pregJson.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Load reference data
    Promise.all([
      fetch("/api/v1/departments").then((r) => r.json()),
      fetch("/api/v1/doctors").then((r) => r.json()),
      fetch("/api/v1/settings/beds?status=available").then((r) => r.json()),
    ]).then(([deptJson, docJson, bedsJson]) => {
      if (deptJson.success) setDepartments(deptJson.data);
      if (docJson.success) setDoctors(docJson.data);
      if (Array.isArray(bedsJson)) setBeds(bedsJson);
    });
  }, [id]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleExportFile = () => {
    if (!patient) return;
    const data = {
      patient: {
        ipp: patient.ipp,
        fullName: `${patient.firstName} ${patient.lastName}`,
        dob: format(new Date(patient.birthDate), "dd/MM/yyyy"),
        gender: patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "Other",
        phone: patient.phone || "N/A",
        address: patient.address || "N/A",
        bloodGroup: patient.bloodGroup || "N/A",
        allergies: patient.allergies || [],
        chronicConditions: patient.chronicConditions || []
      },
      medicalSummary: records.length > 0 
        ? records[0].content.substring(0, 500) + (records[0].content.length > 500 ? "..." : "")
        : "No recent medical notes available.",
      recentVisits: stays.slice(0, 5).map(s => ({
        date: format(new Date(s.admissionDate), "dd/MM/yyyy"),
        type: s.type.charAt(0).toUpperCase() + s.type.slice(1),
        reason: s.admissionReason || "N/A",
        doctor: s.attendingDoctorId || "N/A"
      }))
    };
    setPdfData(data);
    setIsPreviewOpen(true);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    setEditError(null);
    try {
      const payload = {
        ...editForm,
        emergencyContact: (editForm.emergencyName || editForm.emergencyPhone) ? {
          name: editForm.emergencyName, relation: editForm.emergencyRelation, phone: editForm.emergencyPhone
        } : {}
      };
      const res = await fetch(`/api/v1/patients/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsEditOpen(false);
        fetchData();
      }
    } catch (e) {
      setEditError("Failed to save patient");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveStay = async () => {
    setSavingStay(true);
    setStayError(null);
    try {
      const res = await fetch(`/api/v1/patients/${id}/stays`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stayForm)
      });
      if (res.ok) {
        setIsStayOpen(false);
        setStayForm((prev) => ({ ...prev, vitals: EMPTY_VITALS }));
        const [sRes, vitRes] = await Promise.all([
          fetch(`/api/v1/patients/${id}/stays`),
          fetch(`/api/v1/patients/${id}/vitals`),
        ]);
        const [sJson, vitJson] = await Promise.all([sRes.json(), vitRes.json()]);
        if (sJson.success) setStays(sJson.data);
        if (vitJson.success) setVitals(vitJson.data);
      }
    } catch (e) {
      setStayError("Failed to create stay");
    } finally {
      setSavingStay(false);
    }
  };

  const handleSaveRecord = async () => {
    setSavingRecord(true);
    setRecordError(null);
    try {
      const res = await fetch(`/api/v1/patients/${id}/records`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(recordForm)
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        notifyBillingGenerated(json?.billing, tc("invoice_generated"));
        setIsRecordOpen(false);
        const recRes = await fetch(`/api/v1/patients/${id}/records`);
        const recJson = await recRes.json();
        if (recJson.success) setRecords(recJson.data);
      }
    } catch (e) {
      setRecordError("Failed to create record");
    } finally {
      setSavingRecord(false);
    }
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (loading) return <div className="flex h-full items-center justify-center text-xs text-slate-500">Loading…</div>;
  if (error || !patient) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Patient not found</h2>
        <p className="mt-2 text-sm text-slate-500">{error ?? "The requested patient does not exist."}</p>
        <Link href="/patients" className="mt-4 inline-block text-blue-600 text-xs underline">Back to directory</Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <PatientDetailHeader 
        patient={patient} 
        onExport={handleExportFile} 
        onEdit={() => {
          setEditForm({
            firstName: patient.firstName, lastName: patient.lastName, birthDate: patient.birthDate, gender: patient.gender,
            nss: patient.nss || "", bloodGroup: patient.bloodGroup || "", phone: patient.phone || "", email: patient.email || "",
            address: patient.address || "", emergencyName: patient.emergencyContact?.name || "",
            emergencyRelation: patient.emergencyContact?.relation || "", emergencyPhone: patient.emergencyContact?.phone || ""
          });
          setIsEditOpen(true);
        }} 
        onNewAdmission={() => setIsStayOpen(true)} 
      />

      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Left Profile */}
        <PatientQuickProfile patient={patient} latestVitals={vitals[0] ?? null} />

        {/* Right Tabs */}
        <PatientTabs
          stays={stays}
          records={records}
          prescriptions={prescriptions}
          exams={exams}
          billing={billing}
          vitals={vitals}
          surgeries={surgeries}
          pregnancies={pregnancies}
          onAddRecord={() => {
          const defaultAuthorId = session?.user?.id || "";
          setRecordForm(prev => ({ ...prev, authorId: defaultAuthorId }));
          setIsRecordOpen(true);
        }}
        />
      </div>

      {/* Action Sheets */}
      <EditPatientSheet 
        open={isEditOpen} onOpenChange={setIsEditOpen} 
        form={editForm} onUpdateForm={(k, v) => setEditForm(p => ({ ...p, [k]: v }))} 
        saving={savingEdit} error={editError} onSubmit={handleSaveEdit} 
      />
      
      <NewAdmissionSheet 
        open={isStayOpen} onOpenChange={setIsStayOpen} 
        patient={patient} form={stayForm} onUpdateForm={(k, v) => setStayForm(p => ({ ...p, [k]: v }))} 
        departments={departments} doctors={doctors} beds={beds}
        saving={savingStay} error={stayError} onSubmit={handleSaveStay}
      />

      <NewMedicalRecordSheet 
        open={isRecordOpen} onOpenChange={setIsRecordOpen} 
        form={recordForm} onUpdateForm={(k, v) => setRecordForm(p => ({ ...p, [k]: v }))} 
        stays={stays} doctors={doctors} saving={savingRecord} error={recordError} onSubmit={handleSaveRecord} 
      />

      <PDFPreviewModal
        isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)}
        templateId="patient_files" data={pdfData}
        facility={{ name: tc('hospital_name') }} settings={{ watermark: true }}
      />
    </div>
  );
}
