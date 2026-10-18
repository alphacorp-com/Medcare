import type { ResultParameter } from "@/lib/laboratory/results";
import type { RadiologyReportData } from "@/lib/radiology/report";

export type StayPrescriptionItem = {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
};

export type StayPrescription = {
  id: string;
  prescribedAt: string;
  prescriberId: string;
  status: string;
  items?: StayPrescriptionItem[];
};

export type StayExamRequest = {
  id: string;
  requestedAt: string;
  type: string;
  examLabel: string;
  examCode: string;
  urgency: string;
  status: string;
  prescriberId: string;
  completedAt: string | null;
  // Latest result: lab parameters, or a radiology report (which may also carry parameters).
  results?: {
    id: string;
    performerId: string;
    validatedAt: string | null;
    validatedBy: string | null;
    isCritical: boolean;
    resultData: { parameters?: ResultParameter[] } & Partial<RadiologyReportData>;
  }[];
};

export type StayMedicalRecord = {
  id: string;
  type: string;
  title: string | null;
  content: string;
  createdAt: string;
  authorId: string;
  isSigned: boolean;
};

export type StayVitals = {
  id: string;
  recordedAt: string;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  pulse: number | null;
  temperature: string | null;
  weight: string | null;
  height: string | null;
  spo2: number | null;
};

export type StayDetail = {
  id: string;
  patientId: string;
  stayNumber: string;
  type: string;
  status: string;
  admissionDate: string;
  dischargeDate: string | null;
  admissionReason: string | null;
  dischargeSummary: string | null;
  departmentId: string | null;
  bedId: string | null;
  attendingDoctorId: string | null;
  triageAcuity: "resuscitation" | "emergent" | "urgent" | "less_urgent" | "non_urgent" | null;
  pmsiCode: string | null;
  pmsiValidated: boolean;
  consultationStatus: "awaiting_payment" | "waiting" | "claimed" | "completed";
  medicalAct: { code: string; label: string; price: number } | null;
  hospitalization: {
    status: "awaiting_payment" | "admitted";
    actLabel: string | null;
    bedLabel: string | null;
    departmentName: string | null;
    requestedAt: string | null;
    hospitalizedAt: string | null;
  } | null;
  userNames: Record<string, string>;
  vitalSigns: StayVitals[];
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ipp: string;
    birthDate: string;
    gender: string;
    bloodGroup: string | null;
    allergies: unknown;
    chronicConditions: unknown;
  };
  medicalRecords: StayMedicalRecord[];
  prescriptions: StayPrescription[];
  examRequests: StayExamRequest[];
};

export type Doctor = {
  id: string;
  fullName: string;
  specialty: string | null;
};

export type Department = {
  id: string;
  name: string;
  code: string;
};

export type InventoryItem = {
  id: string;
  name: string;
};

export type Bed = {
  id: string;
  code: string;
  label: string;
  departmentId: string;
  roomTypeId?: string | null;
  status: "available" | "occupied" | "maintenance" | "reserved";
};

export type OrderSource = "laboratory" | "radiology" | "medical_act";

export type CatalogOption = {
  code: string;
  label: string;
  price: number | null;
};

export type MedicalActOption = CatalogOption & {
  categoryId: string;
  categoryName: string;
};

export type OrderItem = {
  source: OrderSource;
  code: string;
  urgency: "routine" | "urgent" | "stat";
};
