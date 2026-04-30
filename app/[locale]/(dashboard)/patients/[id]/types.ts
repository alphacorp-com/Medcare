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
};

export type NewStayForm = {
  type: "emergency" | "scheduled" | "day_care" | "outpatient";
  admissionReason: string;
  departmentId: string;
  bedId: string;
  attendingDoctorId: string;
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

export type Department = { id: string; code: string; name: string; type: string | null };
export type Doctor = { id: string; fullName: string; specialty: string | null };

export function ageFromBirthDate(iso: string): number {
  const b = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
