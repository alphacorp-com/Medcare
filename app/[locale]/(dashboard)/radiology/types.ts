import { RadiologyReportData } from "@/lib/radiology/report";

export type ExamRequestStatus = "requested" | "scheduled" | "in_progress" | "completed" | "cancelled";
export type ExamUrgency = "routine" | "urgent" | "stat";

export type RadiologyResult = {
  id: string;
  requestId: string;
  resultData: RadiologyReportData;
  isCritical: boolean;
  criticalNotifiedAt: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  performerId: string;
  reportUrl: string | null;
  createdAt: string;
};

export type RadiologyExam = {
  id: string;
  patientId: string;
  stayId: string | null;
  prescriberId: string;
  examCode: string;
  examLabel: string;
  urgency: ExamUrgency;
  status: ExamRequestStatus;
  requestedAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  notes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ipp: string;
    allergies: unknown;
  };
  results: RadiologyResult[];
};

/** Derived UI-facing state — "awaiting report" isn't a stored status. */
export type RadiologyWorkflowState = "pending_schedule" | "scheduled" | "in_progress" | "awaiting_report" | "completed" | "cancelled";

export function deriveWorkflowState(exam: RadiologyExam): RadiologyWorkflowState {
  if (exam.status === "cancelled") return "cancelled";
  if (exam.status === "completed") return "completed";
  if (exam.status === "requested") return "pending_schedule";
  if (exam.status === "scheduled") return "scheduled";
  const latest = exam.results[0];
  if (latest && !latest.validatedAt) return "awaiting_report";
  return "in_progress";
}

export type ActiveStay = {
  id: string;
  stayNumber: string;
};

export type NewExamForm = {
  patientId: string;
  stayId: string;
  examCode: string;
  examLabel: string;
  urgency: ExamUrgency;
  notes: string;
};

export type RadiologyConflict = {
  examRequestId: string;
  examLabel: string;
  scheduledAt: string;
};

export type UserRef = {
  id: string;
  fullName: string;
};
