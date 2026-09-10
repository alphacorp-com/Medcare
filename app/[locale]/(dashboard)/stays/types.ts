import type { VitalsForm } from "@/components/shared/vitals-fields";

export type { VitalsForm } from "@/components/shared/vitals-fields";
export { EMPTY_VITALS } from "@/components/shared/vitals-fields";

export type StayRow = {
  id: string;
  stayNumber: string;
  type: string;
  status: string;
  admissionDate: string;
  dischargeDate: string | null;
  dischargeSummary: string | null;
  pmsiCode: string | null;
  pmsiValidated: boolean;
  triageAcuity: "resuscitation" | "emergent" | "urgent" | "less_urgent" | "non_urgent" | null;
  patient: {
    firstName: string;
    lastName: string;
    ipp: string;
  };
};

export type Department = {
  id: string;
  code: string;
  name: string;
  type: string | null;
};

export type Doctor = {
  id: string;
  fullName: string;
  specialty: string | null;
};

export type Bed = {
  id: string;
  code: string;
  label: string;
  departmentId: string;
  status: "available" | "occupied" | "maintenance" | "reserved";
};

export type NewStayForm = {
  patientId: string;
  type: "emergency" | "scheduled" | "day_care" | "outpatient";
  admissionReason: string;
  departmentId: string;
  bedId: string;
  attendingDoctorId: string;
  triageAcuity: string;
  vitals: VitalsForm;
};
