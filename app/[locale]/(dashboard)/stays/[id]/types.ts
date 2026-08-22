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
};

export type StayMedicalRecord = {
  id: string;
  type: string;
  title: string | null;
  content: string;
  createdAt: string;
  authorId: string;
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
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ipp: string;
    birthDate: string;
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
