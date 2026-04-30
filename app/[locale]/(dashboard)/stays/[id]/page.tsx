"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// Internal Components
import { StayHeader } from "./_components/StayHeader";
import { AdmissionInfo } from "./_components/AdmissionInfo";
import { StayTabs } from "./_components/StayTabs";
import { TransferSheet } from "./_components/TransferSheet";
import { DischargeSheet } from "./_components/DischargeSheet";
import { PrescriptionSheet } from "./_components/PrescriptionSheet";
import { MedicalOrderSheet } from "./_components/MedicalOrderSheet";

// Types
import { StayDetail, Doctor, Department, InventoryItem } from "./types";

export default function AdmissionDetailPage() {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Sheet states
  const [transferOpen, setTransferOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [rxItems, setRxItems] = useState([{ drug: "", dosage: "", frequency: "", duration: "" }]);

  const fetchStay = async () => {
    try {
      const res = await fetch(`/api/v1/stays/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to fetch stay");
      setStay(json.data as StayDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch stay");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [docsRes, deptsRes, invRes] = await Promise.all([
        fetch('/api/v1/doctors'),
        fetch('/api/v1/departments'),
        fetch('/api/v1/pharmacy/inventory')
      ]);
      const [docsJson, deptsJson, invJson] = await Promise.all([
        docsRes.json(),
        deptsRes.json(),
        invRes.json()
      ]);
      if (docsJson.success) setDoctors(docsJson.data);
      if (deptsJson.success) setDepartments(deptsJson.data);
      if (invJson.success) setInventory(invJson.data);
    } catch (e) {
      console.error("Failed to fetch reference data", e);
    }
  };

  useEffect(() => {
    fetchStay();
    fetchData();
  }, [id]);

  const handleTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      departmentId: formData.get("departmentId"),
      bedId: formData.get("bedId"),
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

  const handleDischarge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      status: "discharged",
      dischargeDate: new Date(formData.get("dischargeDate") as string).toISOString(),
      dischargeSummary: formData.get("dischargeSummary"),
    };

    try {
      const res = await fetch(`/api/v1/stays/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(t('confirm_discharge'));
      setDischargeOpen(false);
      fetchStay();
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
      prescriberId: formData.get("prescriberId"),
      notes: formData.get("notes"),
      items: rxItems.filter(item => item.drug !== ""),
    };

    try {
      const res = await fetch(`/api/v1/stays/${id}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t('error_save'));
      toast.success(t('save_prescription'));
      setPrescriptionOpen(false);
      setRxItems([{ drug: "", dosage: "", frequency: "", duration: "" }]);
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
      prescriberId: formData.get("prescriberId"),
      type: formData.get("type"),
      examLabel: formData.get("examLabel"),
      urgency: formData.get("urgency"),
      notes: formData.get("notes"),
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
      fetchStay();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error_save'));
    } finally {
      setSubmitting(false);
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
      />

      {/* Main Content Section */}
      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden pb-4">
        <AdmissionInfo 
          stay={stay} 
          departments={departments} 
          doctorName={stay.attendingDoctorId ? getDoctorName(stay.attendingDoctorId) : t('unassigned')} 
        />
        
        <StayTabs 
          stay={stay} 
          onPrescriptionOpen={() => setPrescriptionOpen(true)} 
          onOrderOpen={() => setOrderOpen(true)} 
          getDoctorName={getDoctorName} 
        />
      </div>

      {/* Sheets / Modals */}
      <TransferSheet 
        open={transferOpen} 
        onOpenChange={setTransferOpen} 
        stay={stay} 
        departments={departments} 
        doctors={doctors} 
        submitting={submitting} 
        onSubmit={handleTransfer} 
      />

      <DischargeSheet 
        open={dischargeOpen} 
        onOpenChange={setDischargeOpen} 
        submitting={submitting} 
        onSubmit={handleDischarge} 
      />

      <PrescriptionSheet 
        open={prescriptionOpen} 
        onOpenChange={setPrescriptionOpen} 
        doctors={doctors} 
        inventory={inventory} 
        rxItems={rxItems} 
        setRxItems={setRxItems} 
        submitting={submitting} 
        onSubmit={handlePrescription} 
      />

      <MedicalOrderSheet 
        open={orderOpen} 
        onOpenChange={setOrderOpen} 
        doctors={doctors} 
        submitting={submitting} 
        onSubmit={handleOrder} 
      />
    </div>
  );
}
