import { ChecklistPhaseState } from "@/lib/surgery/checklist";
import type { TeamRole } from "@/lib/surgery/validation";

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
  // "SURG-01 · Bloc opératoire 1", resolved by the API.
  roomLabel?: string | null;
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
  expectedDurationMinutes: number | null;
  isEmergency: boolean;
  consentObtainedAt: string | null;
  consentObtainedById: string | null;
  consentNotes: string | null;
  preAnesthesiaAt: string | null;
  preAnesthesiaById: string | null;
  preAnesthesiaNotes: string | null;
  team: TeamMember[];
  anesthesiaStartAt: string | null;
  incisionAt: string | null;
  closureAt: string | null;
  anesthesiaEndAt: string | null;
  statusReason: string | null;
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

export type OperatingRoom = {
  id: string;
  code: string;
  label: string;
};

export type ActiveStay = {
  id: string;
  stayNumber: string;
  admissionDate: string;
};

export type TeamMember = { userId: string; role: TeamRole };

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
  expectedDurationMinutes: string;
  isEmergency: boolean;
  team: TeamMember[];
};

export type SurgeryConflict = {
  resource: "surgeon" | "room";
  procedureId: string;
  procedureLabel: string;
  scheduledAt: string;
  patientName: string;
};
