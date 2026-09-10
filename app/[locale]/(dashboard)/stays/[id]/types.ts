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
  medicalRecords: any[];
  prescriptions: any[];
  examRequests: any[];
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
