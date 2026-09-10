import { ResultParameter } from "@/lib/laboratory/results";

export type ExamRequestStatus = "requested" | "scheduled" | "in_progress" | "completed" | "cancelled";
export type ExamUrgency = "routine" | "urgent" | "stat";

export type LabResult = {
  id: string;
  requestId: string;
  resultData: { parameters: ResultParameter[] };
  isCritical: boolean;
  criticalNotifiedAt: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  performerId: string;
  createdAt: string;
};

export type LabExam = {
  id: string;
  patientId: string;
  stayId: string | null;
  prescriberId: string;
  examCode: string;
  examLabel: string;
  urgency: ExamUrgency;
  status: ExamRequestStatus;
  requestedAt: string;
  completedAt: string | null;
  notes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ipp: string;
  };
  results: LabResult[];
};

/** Derived UI-facing state, since "awaiting validation" isn't a stored status. */
export type LabWorkflowState = "pending_sample" | "in_analysis" | "awaiting_validation" | "completed" | "cancelled";

export function deriveWorkflowState(exam: LabExam): LabWorkflowState {
  if (exam.status === "cancelled") return "cancelled";
  if (exam.status === "completed") return "completed";
  if (exam.status === "requested" || exam.status === "scheduled") return "pending_sample";
  const latest = exam.results[0];
  if (latest && !latest.validatedAt) return "awaiting_validation";
  return "in_analysis";
}

export type ActiveStay = {
  id: string;
  stayNumber: string;
};

export type NewExamForm = {
  patientId: string;
  stayId: string;
  panelCode: string;
  examLabel: string;
  urgency: ExamUrgency;
  notes: string;
};

export type UserRef = {
  id: string;
  fullName: string;
};
