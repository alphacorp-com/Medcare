"use client";

import { toDiagnosisPayload, useDiagnosisErrorMessage } from "@/components/shared/diagnosis-editor";
import type { RecordedDiagnosis } from "@/components/shared/diagnosis-list";
import { useStockErrorMessage } from "@/components/shared/use-stock-error-message";
import { Link } from "@/i18n/routing";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import { usePdfBranding } from "@/components/templates/usePdfBranding";
import type { PatientFileData } from "@/components/templates/PatientFileTemplate";
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
import { useIsMobile } from "@/hooks/use-mobile";
import {
  NewImmunizationSheet,
  AefiSheet,
  useEpiErrorMessage,
  NewMalariaCaseSheet,
  NewTbCaseSheet,
  NewTbFollowUpSheet,
} from "./_components/DiseaseProgramSheets";

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
  VaccineAntigen,
  ImmunizationRow,
  MalariaCaseRow,
  TbCaseRow,
  EditPatientForm,
  NewStayForm,
  NewMedRecordForm,
  NewImmunizationForm,
  NewAefiForm,
  NewMalariaCaseForm,
  NewTbCaseForm,
  NewTbFollowUpForm
} from "./types";

const emptyImmunizationForm = (): NewImmunizationForm => ({
  antigenCode: "", doseNumber: "1", administeredAt: new Date().toISOString().slice(0, 10), stockLotId: "", lotNumber: "", notes: "",
  strategy: "fixed", populationGroup: "", sessionId: "",
});

type ApiResponse = { success?: boolean; error?: string; data?: unknown; userNames?: Record<string, string> };
const PATIENT_FILE_PARTS = ["patient", "stays", "prescriptions", "exams", "records", "billing", "vitals", "surgeries", "pregnancies", "immunizations", "malariaCases", "tbCases", "diagnoses"] as const;
type PatientFileLoad = ({ ok: true } & Record<(typeof PATIENT_FILE_PARTS)[number], ApiResponse>) | { ok: false; error: string };

// Everything the patient file shows, loaded in parallel. A failing section is left as is;
// only the patient itself is required.
async function loadPatientFile(id: string): Promise<PatientFileLoad> {
  const urls = ["", "/stays", "/prescriptions", "/exams", "/records", "/billing", "/vitals", "/surgeries", "/pregnancies", "/immunizations", "/malaria-cases", "/tb-cases", "/diagnoses"]
    .map((suffix) => `/api/v1/patients/${id}${suffix}`);
  try {
    const responses = await Promise.all(urls.map((url) => fetch(url)));
    const bodies: ApiResponse[] = await Promise.all(responses.map((res) => res.json()));
    if (!responses[0].ok || !bodies[0].success) return { ok: false, error: bodies[0].error ?? "Failed to load patient" };
    const parts = Object.fromEntries(PATIENT_FILE_PARTS.map((key, i) => [key, bodies[i]])) as Record<(typeof PATIENT_FILE_PARTS)[number], ApiResponse>;
    return { ok: true, ...parts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load" };
  }
}

export default function PatientDetailPage() {
  const t = useTranslations('patients');
  const diagnosisError = useDiagnosisErrorMessage();
  const stockError = useStockErrorMessage();
  const epiError = useEpiErrorMessage();
  const tc = useTranslations('common');
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { facility: pdfFacility, settings: pdfSettings } = usePdfBranding();
  const isMobile = useIsMobile();

  // Data State
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [diagnoses, setDiagnoses] = useState<RecordedDiagnosis[]>([]);
  const [stays, setStays] = useState<StayRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [examUserNames, setExamUserNames] = useState<Record<string, string>>({});
  const [records, setRecords] = useState<MedicalRecordRow[]>([]);
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [vitals, setVitals] = useState<VitalSignsRow[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryRow[]>([]);
  const [pregnancies, setPregnancies] = useState<PregnancyRow[]>([]);
  const [immunizations, setImmunizations] = useState<ImmunizationRow[]>([]);
  const [malariaCases, setMalariaCases] = useState<MalariaCaseRow[]>([]);
  const [tbCases, setTbCases] = useState<TbCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [antigens, setAntigens] = useState<VaccineAntigen[]>([]);

  // UI State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStayOpen, setIsStayOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isImmunizationOpen, setIsImmunizationOpen] = useState(false);
  const [isMalariaCaseOpen, setIsMalariaCaseOpen] = useState(false);
  const [isTbCaseOpen, setIsTbCaseOpen] = useState(false);
  const [isTbFollowUpOpen, setIsTbFollowUpOpen] = useState(false);
  const [activeTbCaseId, setActiveTbCaseId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<PatientFileData | null>(null);

  // Form States
  const [editForm, setEditForm] = useState<EditPatientForm>({
    firstName: "", lastName: "", birthDate: "", gender: "M", nss: "", bloodGroup: "",
    phone: "", email: "", address: "", emergencyName: "", emergencyRelation: "", emergencyPhone: "",
    allergies: [], chronicConditions: []
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [stayForm, setStayForm] = useState<NewStayForm>({
    type: "emergency", admissionReason: "", departmentId: "", attendingDoctorId: "", triageAcuity: "", medicalActCode: "", vitals: EMPTY_VITALS
  });
  const [savingStay, setSavingStay] = useState(false);
  const [stayError, setStayError] = useState<string | null>(null);

  const [recordForm, setRecordForm] = useState<NewMedRecordForm>({
    type: "consultation", title: "", content: "", stayId: "", isSigned: false, diagnoses: []
  });
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [immunizationForm, setImmunizationForm] = useState<NewImmunizationForm>(emptyImmunizationForm);
  // AEFI (MAPI) declared on a dose of this patient.
  const [aefiDose, setAefiDose] = useState<ImmunizationRow | null>(null);
  const [savingAefi, setSavingAefi] = useState(false);
  const [aefiError, setAefiError] = useState<string | null>(null);
  const [savingImmunization, setSavingImmunization] = useState(false);
  const [immunizationError, setImmunizationError] = useState<string | null>(null);

  const [malariaCaseForm, setMalariaCaseForm] = useState<NewMalariaCaseForm>({
    testType: "rdt", result: "pending", severity: "", isPregnantAtDiagnosis: false,
    treatedWithAct: false, treatmentDrugName: "", notes: "", species: "", treatment: "", hospitalized: false, freeOfCharge: false
  });
  const [savingMalariaCase, setSavingMalariaCase] = useState(false);
  const [malariaCaseError, setMalariaCaseError] = useState<string | null>(null);

  const [tbCaseForm, setTbCaseForm] = useState<NewTbCaseForm>({
    caseType: "new_case", classification: "pulmonary_bacteriologically_confirmed", hivStatus: "unknown",
    treatmentRegimen: "", notes: "", rifampicinResistant: false, secondLineStartedAt: "", cotrimoxazole: false, isHealthWorker: false
  });
  const [savingTbCase, setSavingTbCase] = useState(false);
  const [tbCaseError, setTbCaseError] = useState<string | null>(null);

  const [tbFollowUpForm, setTbFollowUpForm] = useState<NewTbFollowUpForm>({
    controlPoint: "m2", sputumResult: "not_done", outcomeRecorded: ""
  });
  const [savingTbFollowUp, setSavingTbFollowUp] = useState(false);
  const [tbFollowUpError, setTbFollowUpError] = useState<string | null>(null);

  // State is only ever set in promise callbacks (never synchronously in an effect), and a
  // response arriving after unmount or a change of patient is dropped by the effect below.
  const applyPatientFile = useCallback((file: PatientFileLoad) => {
    if (!file.ok) {
      setError(file.error);
      setLoading(false);
      return;
    }
    const { patient, stays, prescriptions, exams, records, billing, vitals, surgeries, pregnancies, immunizations, malariaCases, tbCases, diagnoses } = file;
    setPatient(patient.data as PatientDetail);
    if (stays.success) setStays(stays.data as StayRow[]);
    if (prescriptions.success) setPrescriptions(prescriptions.data as PrescriptionRow[]);
    if (exams.success) {
      setExams(exams.data as ExamRow[]);
      setExamUserNames(exams.userNames ?? {});
    }
    if (records.success) setRecords(records.data as MedicalRecordRow[]);
    if (billing.success) setBilling(billing.data as BillingRow[]);
    if (vitals.success) setVitals(vitals.data as VitalSignsRow[]);
    if (surgeries.success) setSurgeries(surgeries.data as SurgeryRow[]);
    if (pregnancies.success) setPregnancies(pregnancies.data as PregnancyRow[]);
    if (immunizations.success) setImmunizations(immunizations.data as ImmunizationRow[]);
    if (malariaCases.success) setMalariaCases(malariaCases.data as MalariaCaseRow[]);
    if (tbCases.success) setTbCases(tbCases.data as TbCaseRow[]);
    if (diagnoses.success) setDiagnoses(diagnoses.data as RecordedDiagnosis[]);
    setLoading(false);
  }, []);

  const fetchData = useCallback(() => loadPatientFile(id).then(applyPatientFile), [id, applyPatientFile]);

  useEffect(() => {
    let active = true;
    void loadPatientFile(id).then((file) => {
      if (active) applyPatientFile(file);
    });
    // Reference data
    Promise.all([
      fetch("/api/v1/departments").then((r) => r.json()),
      fetch("/api/v1/doctors").then((r) => r.json()),
      fetch("/api/v1/settings/reference-data/vaccine_antigen").then((r) => r.json()),
    ]).then(([deptJson, docJson, antigensJson]) => {
      if (!active) return;
      if (deptJson.success) setDepartments(deptJson.data);
      if (docJson.success) setDoctors(docJson.data);
      if (Array.isArray(antigensJson)) setAntigens(antigensJson);
    }).catch((e) => console.error("Failed to fetch reference data", e));
    return () => {
      active = false;
    };
  }, [id, applyPatientFile]);

  // Deep-link from the consultation queue (/consultations "Claim"/"Continue"): pre-fill
  // and open the same "add medical record" sheet used everywhere else, pre-selected to
  // the consultation type and linked to the stay the doctor just claimed.
  useEffect(() => {
    if (searchParams.get("openConsultation") !== "1") return;
    const stayIdParam = searchParams.get("stayId") || "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecordForm((prev) => ({
      ...prev,
      type: "consultation",
      stayId: stayIdParam,
    }));
    setIsRecordOpen(true);
  }, [searchParams, session?.user?.id]);

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
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setStayError(json?.error ?? "Failed to create stay");
      } else {
        setIsStayOpen(false);
        setStayForm((prev) => ({ ...prev, medicalActCode: "", vitals: EMPTY_VITALS }));
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...recordForm, diagnoses: toDiagnosisPayload(recordForm.diagnoses) })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setRecordError(diagnosisError(json) ?? json?.error ?? "Failed to create record");
        return;
      }
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        notifyBillingGenerated(json?.billing, tc("invoice_generated"));
        setIsRecordOpen(false);
        const [recJson, dxJson] = await Promise.all([
          fetch(`/api/v1/patients/${id}/records`).then((r) => r.json()),
          fetch(`/api/v1/patients/${id}/diagnoses`).then((r) => r.json()),
        ]);
        if (recJson.success) setRecords(recJson.data);
        if (dxJson.success) setDiagnoses(dxJson.data);
      }
    } catch (e) {
      setRecordError("Failed to create record");
    } finally {
      setSavingRecord(false);
    }
  };

  const handleSaveImmunization = async () => {
    setSavingImmunization(true);
    setImmunizationError(null);
    try {
      const res = await fetch(`/api/v1/patients/${id}/immunizations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...immunizationForm,
          doseNumber: Number(immunizationForm.doseNumber) || 1,
          stockLotId: immunizationForm.stockLotId || undefined,
          populationGroup: immunizationForm.populationGroup || undefined,
          sessionId: immunizationForm.sessionId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(stockError(json) ?? json.error ?? "Failed to record immunization");
      setIsImmunizationOpen(false);
      setImmunizationForm(emptyImmunizationForm());
      const immRes = await fetch(`/api/v1/patients/${id}/immunizations`);
      const immJson = await immRes.json();
      if (immJson.success) setImmunizations(immJson.data);
    } catch (e) {
      setImmunizationError(e instanceof Error ? e.message : "Failed to record immunization");
    } finally {
      setSavingImmunization(false);
    }
  };

  const handleSaveAefi = async (form: NewAefiForm) => {
    if (!aefiDose) return;
    setSavingAefi(true);
    setAefiError(null);
    try {
      const res = await fetch("/api/v1/aefi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, immunizationId: aefiDose.id, onsetAt: new Date(form.onsetAt).toISOString() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(epiError(json) ?? json.error ?? tc("unknown_error"));
      setAefiDose(null);
      const immJson = await fetch(`/api/v1/patients/${id}/immunizations`).then((r) => r.json());
      if (immJson.success) setImmunizations(immJson.data);
    } catch (e) {
      setAefiError(e instanceof Error ? e.message : tc("unknown_error"));
    } finally {
      setSavingAefi(false);
    }
  };

  const handleSaveMalariaCase = async () => {
    setSavingMalariaCase(true);
    setMalariaCaseError(null);
    try {
      const res = await fetch(`/api/v1/patients/${id}/malaria-cases`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...malariaCaseForm,
          severity: malariaCaseForm.severity || undefined,
          species: malariaCaseForm.result === "positive" && malariaCaseForm.species ? malariaCaseForm.species : undefined,
          treatment: malariaCaseForm.treatment || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to record malaria case");
      setIsMalariaCaseOpen(false);
      setMalariaCaseForm({ testType: "rdt", result: "pending", severity: "", isPregnantAtDiagnosis: false, treatedWithAct: false, treatmentDrugName: "", notes: "", species: "", treatment: "", hospitalized: false, freeOfCharge: false });
      const malRes = await fetch(`/api/v1/patients/${id}/malaria-cases`);
      const malJson = await malRes.json();
      if (malJson.success) setMalariaCases(malJson.data);
    } catch (e) {
      setMalariaCaseError(e instanceof Error ? e.message : "Failed to record malaria case");
    } finally {
      setSavingMalariaCase(false);
    }
  };

  const handleSaveTbCase = async () => {
    setSavingTbCase(true);
    setTbCaseError(null);
    try {
      const res = await fetch(`/api/v1/patients/${id}/tb-cases`, {
        method: "POST", headers: { "Content-Type": "application/json" }, // A second-line date only goes with TB-RR.
        body: JSON.stringify({ ...tbCaseForm, secondLineStartedAt: tbCaseForm.rifampicinResistant ? tbCaseForm.secondLineStartedAt : "" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to register TB case");
      setIsTbCaseOpen(false);
      setTbCaseForm({ caseType: "new_case", classification: "pulmonary_bacteriologically_confirmed", hivStatus: "unknown", treatmentRegimen: "", notes: "", rifampicinResistant: false, secondLineStartedAt: "", cotrimoxazole: false, isHealthWorker: false });
      const tbRes = await fetch(`/api/v1/patients/${id}/tb-cases`);
      const tbJson = await tbRes.json();
      if (tbJson.success) setTbCases(tbJson.data);
    } catch (e) {
      setTbCaseError(e instanceof Error ? e.message : "Failed to register TB case");
    } finally {
      setSavingTbCase(false);
    }
  };

  const handleSaveTbFollowUp = async () => {
    if (!activeTbCaseId) return;
    setSavingTbFollowUp(true);
    setTbFollowUpError(null);
    try {
      const res = await fetch(`/api/v1/tb-cases/${activeTbCaseId}/follow-ups`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tbFollowUpForm, outcomeRecorded: tbFollowUpForm.outcomeRecorded || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to record follow-up");
      setIsTbFollowUpOpen(false);
      setActiveTbCaseId(null);
      setTbFollowUpForm({ controlPoint: "m2", sputumResult: "not_done", outcomeRecorded: "" });
      const tbRes = await fetch(`/api/v1/patients/${id}/tb-cases`);
      const tbJson = await tbRes.json();
      if (tbJson.success) setTbCases(tbJson.data);
    } catch (e) {
      setTbFollowUpError(e instanceof Error ? e.message : "Failed to record follow-up");
    } finally {
      setSavingTbFollowUp(false);
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

  const detailContent = (
    <>
      <div className="flex flex-col h-full space-y-4">
        <PatientDetailHeader
          patient={patient}
          onExport={handleExportFile}
          onEdit={() => {
            setEditForm({
              firstName: patient.firstName, lastName: patient.lastName, birthDate: patient.birthDate, gender: patient.gender,
              nss: patient.nss || "", bloodGroup: patient.bloodGroup || "", phone: patient.phone || "", email: patient.email || "",
              address: patient.address || "", emergencyName: patient.emergencyContact?.name || "",
              emergencyRelation: patient.emergencyContact?.relation || "", emergencyPhone: patient.emergencyContact?.phone || "",
              allergies: patient.allergies || [], chronicConditions: patient.chronicConditions || []
            });
            setIsEditOpen(true);
          }}
          onNewAdmission={() => setIsStayOpen(true)}
        />

        {/* Desktop: the row is as tall as the grid (not as its content), so each column scrolls on its own. */}
        <div className={`grid gap-4 flex-1 min-h-0 ${isMobile ? "grid-cols-1" : "grid-cols-12 grid-rows-[minmax(0,1fr)] overflow-hidden"}`}>
          <div className={isMobile ? "w-full" : "col-span-3 min-h-0 overflow-y-auto"}>
            <PatientQuickProfile patient={patient} latestVitals={vitals[0] ?? null} diagnoses={diagnoses} />
          </div>

          <div className={isMobile ? "w-full" : "col-span-9 min-h-0 flex flex-col"}>
            <PatientTabs
              stays={stays}
              records={records}
              prescriptions={prescriptions}
              exams={exams}
              examUserNames={examUserNames}
              billing={billing}
              vitals={vitals}
              surgeries={surgeries}
              pregnancies={pregnancies}
              immunizations={immunizations}
              malariaCases={malariaCases}
              tbCases={tbCases}
              onAddRecord={() => setIsRecordOpen(true)}
              onAddImmunization={() => setIsImmunizationOpen(true)}
              onReportAefi={(dose) => { setAefiError(null); setAefiDose(dose); }}
              onAddMalariaCase={() => setIsMalariaCaseOpen(true)}
              onAddTbCase={() => setIsTbCaseOpen(true)}
              onAddTbFollowUp={(tbCaseId) => { setActiveTbCaseId(tbCaseId); setIsTbFollowUpOpen(true); }}
            />
          </div>
        </div>
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
        departments={departments} doctors={doctors}
        saving={savingStay} error={stayError} onSubmit={handleSaveStay}
      />

      <NewMedicalRecordSheet
        open={isRecordOpen} onOpenChange={setIsRecordOpen}
        form={recordForm} onUpdateForm={(k, v) => setRecordForm(p => ({ ...p, [k]: v }))}
        stays={stays} saving={savingRecord} error={recordError} onSubmit={handleSaveRecord}
      />

      <NewImmunizationSheet
        open={isImmunizationOpen} onOpenChange={setIsImmunizationOpen}
        form={immunizationForm} onUpdateForm={(k, v) => setImmunizationForm(p => ({ ...p, [k]: v }))}
        antigens={antigens} saving={savingImmunization} error={immunizationError} onSubmit={handleSaveImmunization}
      />

      <AefiSheet
        dose={aefiDose}
        onOpenChange={(open) => { if (!open) { setAefiDose(null); setAefiError(null); } }}
        saving={savingAefi}
        error={aefiError}
        onSubmit={handleSaveAefi}
      />

      <NewMalariaCaseSheet
        open={isMalariaCaseOpen} onOpenChange={setIsMalariaCaseOpen}
        form={malariaCaseForm} onUpdateForm={(k, v) => setMalariaCaseForm(p => ({ ...p, [k]: v }))}
        saving={savingMalariaCase} error={malariaCaseError} onSubmit={handleSaveMalariaCase}
      />

      <NewTbCaseSheet
        open={isTbCaseOpen} onOpenChange={setIsTbCaseOpen}
        form={tbCaseForm} onUpdateForm={(k, v) => setTbCaseForm(p => ({ ...p, [k]: v }))}
        saving={savingTbCase} error={tbCaseError} onSubmit={handleSaveTbCase}
      />

      <NewTbFollowUpSheet
        open={isTbFollowUpOpen} onOpenChange={setIsTbFollowUpOpen}
        form={tbFollowUpForm} onUpdateForm={(k, v) => setTbFollowUpForm(p => ({ ...p, [k]: v }))}
        saving={savingTbFollowUp} error={tbFollowUpError} onSubmit={handleSaveTbFollowUp}
      />

      <PDFPreviewModal
        isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)}
        templateId="patient_files" data={pdfData}
        facility={pdfFacility}
        settings={pdfSettings}
      />
    </>
  );

  return detailContent;
}
