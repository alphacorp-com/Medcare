import type { VitalsForm } from "@/components/shared/vitals-fields";

export type EmergencyContact = { name?: string; relation?: string; phone?: string };

export type PatientDetail = {
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

export type EditPatientForm = {
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
  allergies: string[];
  chronicConditions: string[];
};

export type NewStayForm = {
  type: "emergency" | "scheduled" | "day_care" | "outpatient";
  admissionReason: string;
  departmentId: string;
  bedId: string;
  attendingDoctorId: string;
  triageAcuity: string;
  vitals: VitalsForm;
};

export type VitalSignsRow = {
  id: string;
  recordedAt: string;
  recordedById: string;
  stayId: string | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  pulse: number | null;
  temperature: string | null;
  weight: string | null;
  height: string | null;
  spo2: number | null;
};

export type NewMedRecordForm = {
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

export type StayRow = {
  id: string;
  stayNumber: string;
  type: string;
  status: string;
  admissionDate: string;
  dischargeDate: string | null;
  admissionReason: string | null;
  dischargeSummary: string | null;
  pmsiCode: string | null;
  pmsiValidated: boolean;
  departmentId: string | null;
  bedId: string | null;
  attendingDoctorId: string | null;
};

export type PrescriptionItem = { drug?: string; name?: string; dose?: string; frequency?: string; [k: string]: unknown };

export type PrescriptionRow = {
  id: string;
  status: string;
  prescribedAt: string;
  items: PrescriptionItem[] | unknown;
  prescriberId: string;
  drugDispensings?: { id: string; dispensedAt: string }[];
};

export type ExamResult = { id: string; resultData: unknown; isCritical: boolean; createdAt: string };

export type ExamRow = {
  id: string;
  type: string;
  examCode: string;
  examLabel: string;
  status: string;
  requestedAt: string;
  results: ExamResult[];
};

export type MedicalRecordRow = {
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

export type BillingRow = {
  id: string;
  status: string;
  subtotal: string;
  insuranceAmount: string;
  patientAmount: string;
  paidAmount: string;
  currency: string;
  createdAt: string;
  stay?: {
    stayNumber: string;
    admissionDate: string;
    dischargeDate: string | null;
  } | null;
  lines: { id: string; description: string; amount: string }[];
};

export type SurgeryRow = {
  id: string;
  procedureLabel: string;
  procedureCode: string | null;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type PregnancyRow = {
  id: string;
  status: string;
  lastMenstrualPeriod: string;
  expectedDueDate: string;
  gravida: number;
  para: number;
  delivery?: {
    id: string;
    deliveryDate: string | null;
    mode: string | null;
    newborns: { id: string }[];
  } | null;
  antenatalVisits: { id: string; visitNumber: number; visitDate: string }[];
};

export type Department = { id: string; code: string; name: string; type: string | null };
export type Doctor = { id: string; fullName: string; specialty: string | null };
export type Bed = { id: string; code: string; label: string; departmentId: string; status: "available" | "occupied" | "maintenance" | "reserved" };

export type VaccineAntigen = { id: string; code: string; nameFr: string; nameEn: string | null; group: string | null };

export type ImmunizationRow = {
  id: string;
  antigenCode: string;
  antigenName: string;
  doseNumber: number;
  administeredAt: string;
  lotNumber: string | null;
  isOutOfSchedule: boolean;
  notes: string | null;
};

export type NewImmunizationForm = {
  antigenCode: string;
  doseNumber: string;
  administeredAt: string;
  lotNumber: string;
  notes: string;
};

export type MalariaCaseRow = {
  id: string;
  testType: "rdt" | "microscopy" | "clinical_only";
  result: "pending" | "positive" | "negative";
  severity: "simple" | "severe" | null;
  isPregnantAtDiagnosis: boolean;
  diagnosedAt: string;
  treatedWithAct: boolean;
  treatmentDrugName: string | null;
};

export type NewMalariaCaseForm = {
  testType: "rdt" | "microscopy" | "clinical_only";
  result: "pending" | "positive" | "negative";
  severity: "" | "simple" | "severe";
  isPregnantAtDiagnosis: boolean;
  treatedWithAct: boolean;
  treatmentDrugName: string;
  notes: string;
};

export type TbFollowUpRow = {
  id: string;
  followUpDate: string;
  controlPoint: "m2" | "m3" | "m5" | "m6" | "other";
  sputumResult: "not_done" | "negative" | "positive";
  outcomeRecorded: string | null;
};

export type TbCaseRow = {
  id: string;
  notificationDate: string;
  caseType: string;
  classification: "pulmonary_bacteriologically_confirmed" | "pulmonary_clinically_diagnosed" | "extrapulmonary";
  hivStatus: "positive" | "negative" | "unknown";
  outcome: string;
  followUps: TbFollowUpRow[];
};

export type NewTbCaseForm = {
  caseType: string;
  classification: "pulmonary_bacteriologically_confirmed" | "pulmonary_clinically_diagnosed" | "extrapulmonary";
  hivStatus: "positive" | "negative" | "unknown";
  treatmentRegimen: string;
  notes: string;
};

export type NewTbFollowUpForm = {
  controlPoint: "m2" | "m3" | "m5" | "m6" | "other";
  sputumResult: "not_done" | "negative" | "positive";
  outcomeRecorded: string;
};

export function ageFromBirthDate(iso: string): number {
  const b = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
