import { ChecklistPhaseState } from "@/lib/surgery/checklist";

export type SurgicalStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "postponed";

export type WhoChecklist = Partial<{
  signIn: ChecklistPhaseState;
  timeOut: ChecklistPhaseState;
  signOut: ChecklistPhaseState;
}>;

export type Surgery = {
  id: string;
  patientId: string;
  stayId: string | null;
  surgeonId: string;
  anesthesiologistId: string | null;
  roomId: string | null;
  procedureCode: string | null;
  procedureLabel: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: SurgicalStatus;
  asaScore: number | null;
  whoChecklist: WhoChecklist;
  surgicalReport: string | null;
  anesthesiaReport: string | null;
  complications: unknown;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ipp: string;
  };
};

export type Doctor = {
  id: string;
  fullName: string;
  specialty: string | null;
};

export type ActiveStay = {
  id: string;
  stayNumber: string;
  admissionDate: string;
};

export type NewSurgeryForm = {
  patientId: string;
  stayId: string;
  surgeonId: string;
  anesthesiologistId: string;
  procedureLabel: string;
  procedureCode: string;
  roomId: string;
  scheduledAt: string;
  asaScore: string;
};

export type SurgeryConflict = {
  resource: "surgeon" | "room";
  procedureId: string;
  procedureLabel: string;
  scheduledAt: string;
  patientName: string;
};
