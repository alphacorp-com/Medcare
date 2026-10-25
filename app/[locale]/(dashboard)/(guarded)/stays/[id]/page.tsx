"use client";

import { useDiagnosisErrorMessage } from "@/components/shared/diagnosis-editor";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// Internal Components
import { StayHeader } from "./_components/StayHeader";
import { AdmissionInfo } from "./_components/AdmissionInfo";
import { StayTabs } from "./_components/StayTabs";
import { TransferSheet } from "./_components/TransferSheet";
import { RetriageSheet } from "./_components/RetriageSheet";
import { DischargeSheet, dischargePayload } from "./_components/DischargeSheet";
import { EMPTY_RX_ITEM, PrescriptionSheet, prescriptionPayloadItems, usePrescriptionErrorMessage, type RxItem } from "./_components/PrescriptionSheet";
import { MedicalOrderSheet } from "./_components/MedicalOrderSheet";
import { VitalsSheet } from "./_components/VitalsSheet";
import { HospitalizationSheet } from "./_components/HospitalizationSheet";
import { ComplementaryNoteSheet } from "./_components/ComplementaryNoteSheet";
import { buildMedicalRecord } from "./_components/buildMedicalRecord";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import { usePdfBranding } from "@/components/templates/usePdfBranding";
import type { MedicalRecordData } from "@/components/templates/MedicalRecordTemplate";
import { EMPTY_VITALS, VitalsForm } from "@/components/shared/vitals-fields";
import { notifyBillingGenerated } from "@/lib/billing/client";

// Types
import { StayDetail, Doctor, Department, Bed, CatalogOption, MedicalActOption, OrderItem } from "./types";
import type { TriageAcuity } from "@/components/shared/triage-badge";
import { useConfirm } from "@/components/providers/confirm-provider";

type StayLoad = { ok: true; stay: StayDetail } | { ok: false; error: string };

async function loadStay(id: string): Promise<StayLoad> {
  try {
    const res = await fetch(`/api/v1/stays/${id}`);
    const json = await res.json();
    if (!res.ok || !json.success) return { ok: false, error: json.error ?? "Failed to fetch stay" };
    return { ok: true, stay: json.data as StayDetail };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch stay" };
  }
}

type StayReferenceData = {
  doctors?: Doctor[];
  departments?: Department[];
  beds?: Bed[];
  labCatalog?: CatalogOption[];
  radiologyCatalog?: CatalogOption[];
  medicalActs?: MedicalActOption[];
};

// Reference lists of the stay screens; a list that fails to load is left out (undefined).
async function loadReferenceData(): Promise<StayReferenceData> {
  try {
    const [docsJson, deptsJson, bedsJson, labJson, radioJson, actsJson] = await Promise.all(
      ["/api/v1/doctors", "/api/v1/departments", "/api/v1/settings/beds", "/api/v1/exam-catalog?domain=laboratory", "/api/v1/exam-catalog?domain=radiology", "/api/v1/medical-acts"]
        .map((url) => fetch(url).then((r) => r.json()))
    );
    return {
      doctors: docsJson.success ? docsJson.data : undefined,
      departments: deptsJson.success ? deptsJson.data : undefined,
      beds: Array.isArray(bedsJson) ? bedsJson : undefined,
      labCatalog: Array.isArray(labJson) ? labJson : undefined,
      radiologyCatalog: Array.isArray(radioJson) ? radioJson : undefined,
      medicalActs: Array.isArray(actsJson) ? actsJson : undefined,
    };
  } catch (e) {
    console.error("Failed to fetch reference data", e);
    return {};
  }
}

export default function AdmissionDetailPage() {
  const t = useTranslations('admissions');
  const confirm = useConfirm();
  const diagnosisError = useDiagnosisErrorMessage();
  const tc = useTranslations('common');
  const tm = useTranslations('documents.medicalRecord');
  const td = useTranslations('discharges');
  const { facility: pdfFacility, settings: pdfSettings } = usePdfBranding();
  const params = useParams();
  const id = params.id as string;
  
  // Data State
  const [stay, setStay] = useState<StayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reference Data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [labCatalog, setLabCatalog] = useState<CatalogOption[]>([]);
  const [radiologyCatalog, setRadiologyCatalog] = useState<CatalogOption[]>([]);
  const [medicalActs, setMedicalActs] = useState<MedicalActOption[]>([]);

  // Sheet states
  const [transferOpen, setTransferOpen] = useState(false);
  const [retriageOpen, setRetriageOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [hospitalizeOpen, setHospitalizeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [recordPdf, setRecordPdf] = useState<MedicalRecordData | null>(null);
  const [vitalsForm, setVitalsForm] = useState<VitalsForm>(EMPTY_VITALS);
  const [rxItems, setRxItems] = useState<RxItem[]>([{ ...EMPTY_RX_ITEM }]);
  const prescriptionError = usePrescriptionErrorMessage();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ source: "laboratory", code: "", urgency: "routine" }]);

  // State is only ever set in promise callbacks (never synchronously in an effect), and a
  // response arriving after unmount or a change of stay is dropped by the effect below.
  const applyStay = useCallback((result: StayLoad) => {
    if (result.ok) setStay(result.stay);
    else setError(result.error);
    setLoading(false);
  }, []);

  const applyReferenceData = useCallback((data: StayReferenceData) => {
    if (data.doctors) setDoctors(data.doctors);
    if (data.departments) setDepartments(data.departments);
    if (data.beds) setBeds(data.beds);
    if (data.labCatalog) setLabCatalog(data.labCatalog);
    if (data.radiologyCatalog) setRadiologyCatalog(data.radiologyCatalog);
    if (data.medicalActs) setMedicalActs(data.medicalActs);
  }, []);

  const fetchStay = useCallback(() => loadStay(id).then(applyStay), [id, applyStay]);
  const fetchData = useCallback(() => loadReferenceData().then(applyReferenceData), [applyReferenceData]);

  useEffect(() => {
    let active = true;
    void loadStay(id).then((result) => {
      if (active) applyStay(result);
    });
    void loadReferenceData().then((data) => {
      if (active) applyReferenceData(data);
    });
    return () => {
      active = false;
    };
  }, [id, applyStay, applyReferenceData]);

  const handleTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      departmentId: formData.get("departmentId"),
      // Only a hospitalised patient changes bed here; for any other stay the field is absent
      // and the bed is left untouched (it is assigned by hospitalising the patient).
      ...(formData.has("bedId") ? { bedId: formData.get("bedId") } : {}),
      attendingDoctorId: formData.get("attendingDoctorId"),
    };

    try {
      const res = await fetch(`/api/v1/stays/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(tc('save_changes'));
      setTransferOpen(false);
      fetchStay();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetriage = async (acuity: TriageAcuity) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/stays/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triageAcuity: acuity }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(tc('save_changes'));
      setRetriageOpen(false);
      fetchStay();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDischarge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = dischargePayload(formData);

    try {
      const res = await fetch(`/api/v1/stays/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(diagnosisError(json) ?? json.error ?? t('error_save'));
      toast.success(td('discharged_toast'));
      if (json.billing?.actualDays) toast.info(td('regularized_toast', { days: json.billing.actualDays }));
      setDischargeOpen(false);
      // The discharge record (medical record with the discharge mention) is generated
      // right away; handlePrint re-fetches the stay, so it also refreshes the page.
      await handlePrint();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrescription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      notes: formData.get("notes"),
      items: prescriptionPayloadItems(rxItems),
    };

    try {
      const res = await fetch(`/api/v1/stays/${id}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(prescriptionError(json) ?? json.error ?? t('error_save'));
      toast.success(t('save_prescription'));
      setPrescriptionOpen(false);
      setRxItems([{ ...EMPTY_RX_ITEM }]);
      fetchStay();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      notes: formData.get("notes"),
      items: orderItems.filter((item) => item.code !== ""),
    };

    try {
      const res = await fetch(`/api/v1/stays/${id}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(t('save_order'));
      setOrderOpen(false);
      setOrderItems([{ source: "laboratory", code: "", urgency: "routine" }]);
      fetchStay();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/exam-requests/${orderId}/complete`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(t('order_completed'));
      notifyBillingGenerated(json.billing, tc('invoice_generated'));
      fetchStay();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!(await confirm({ message: t('confirm_cancel_order'), tone: "danger" }))) return;
    try {
      const res = await fetch(`/api/v1/exam-requests/${orderId}/cancel`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(t('order_cancelled'));
      fetchStay();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    }
  };

  const handleVitals = async () => {
    if (!stay) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/patients/${stay.patientId}/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stayId: id, ...vitalsForm }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(t('save_vitals'));
      setVitalsOpen(false);
      setVitalsForm(EMPTY_VITALS);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelHospitalization = async () => {
    if (!(await confirm({ message: t('confirm_cancel_hospitalization'), tone: "danger" }))) return;
    try {
      const res = await fetch(`/api/v1/stays/${id}/hospitalization`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(t('hospitalization_cancelled'));
      fetchStay();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    }
  };

  // Re-fetches first so the printout reflects results validated since the page loaded.
  const handlePrint = async () => {
    try {
      const res = await fetch(`/api/v1/stays/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to fetch stay");
      setStay(json.data as StayDetail);
      setRecordPdf(buildMedicalRecord(json.data as StayDetail, t, tm));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    }
  };

  const getDoctorName = (doctorId: string) => {
    return doctors.find(d => d.id === doctorId)?.fullName || doctorId;
  };

  if (loading && !stay) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !stay) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-sm">{error || "Stay not found"}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Section */}
      <StayHeader
        stay={stay}
        onTransferOpen={() => setTransferOpen(true)}
        onDischargeOpen={() => setDischargeOpen(true)}
        onVitalsOpen={() => setVitalsOpen(true)}
        onRetriageOpen={() => setRetriageOpen(true)}
        onHospitalizeOpen={() => setHospitalizeOpen(true)}
        onCancelHospitalization={handleCancelHospitalization}
        onNoteOpen={() => setNoteOpen(true)}
        onPrint={handlePrint}
      />

      {/* Main Content Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 lg:overflow-hidden pb-4">
        <AdmissionInfo
          stay={stay}
          departments={departments}
          beds={beds}
          doctorName={stay.attendingDoctorId ? getDoctorName(stay.attendingDoctorId) : t('unassigned')}
        />

        <StayTabs
          stay={stay}
          onPrescriptionOpen={() => setPrescriptionOpen(true)}
          onOrderOpen={() => setOrderOpen(true)}
          onCompleteOrder={handleCompleteOrder}
          onCancelOrder={handleCancelOrder}
          getDoctorName={getDoctorName}
        />
      </div>

      {/* Sheets / Modals */}
      <TransferSheet
        key={`${stay.departmentId}-${stay.bedId}`}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        stay={stay}
        departments={departments}
        doctors={doctors}
        beds={beds}
        submitting={submitting}
        onSubmit={handleTransfer}
      />

      <RetriageSheet
        open={retriageOpen}
        onOpenChange={setRetriageOpen}
        stay={stay}
        submitting={submitting}
        onSubmit={handleRetriage}
      />

      <DischargeSheet
        open={dischargeOpen} 
        onOpenChange={setDischargeOpen} 
        submitting={submitting} 
        onSubmit={handleDischarge} 
        hospitalized={stay.hospitalization?.status === "admitted"}
      />

      <PrescriptionSheet 
        open={prescriptionOpen} 
        onOpenChange={setPrescriptionOpen} 
        rxItems={rxItems} 
        setRxItems={setRxItems} 
        submitting={submitting} 
        onSubmit={handlePrescription} 
      />

      <MedicalOrderSheet
        open={orderOpen}
        onOpenChange={setOrderOpen}        labCatalog={labCatalog}
        radiologyCatalog={radiologyCatalog}
        medicalActs={medicalActs}
        orderItems={orderItems}
        setOrderItems={setOrderItems}
        submitting={submitting}
        onSubmit={handleOrder}
      />

      <HospitalizationSheet
        open={hospitalizeOpen}
        onOpenChange={setHospitalizeOpen}
        stayId={id}
        departments={departments}
        beds={beds}
        onDone={() => {
          fetchStay();
          fetchData();
        }}
      />

      <ComplementaryNoteSheet
        open={noteOpen}
        onOpenChange={setNoteOpen}
        patientId={stay.patientId}
        stayId={id}
        onDone={fetchStay}
      />

      <PDFPreviewModal
        isOpen={Boolean(recordPdf)}
        onClose={() => setRecordPdf(null)}
        templateId="medical_record"
        data={recordPdf}
        facility={pdfFacility}
        settings={pdfSettings}
      />

      <VitalsSheet
        open={vitalsOpen}
        onOpenChange={setVitalsOpen}
        value={vitalsForm}
        onChange={setVitalsForm}
        submitting={submitting}
        onSubmit={handleVitals}
      />
    </div>
  );
}
