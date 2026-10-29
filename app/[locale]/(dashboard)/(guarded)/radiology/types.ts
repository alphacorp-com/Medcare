import { RadiologyReportData } from "@/lib/radiology/report";
import type { SafetyCheck } from "@/lib/radiology/safety";

export type ExamRequestStatus = "awaiting_payment" | "requested" | "scheduled" | "in_progress" | "completed" | "cancelled";
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
  // Corrections appended after validation (exam detail only).
  addenda?: { id: string; text: string; authorId: string; createdAt: string }[];
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
  deviceId?: string | null;
  expectedDurationMinutes?: number | null;
  accessionNumber?: string | null;
  safetyCheck?: SafetyCheck | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ipp: string;
    allergies: unknown;
    gender?: string | null;
  };
  results: RadiologyResult[];
};

/** Derived UI-facing state — "awaiting report" isn't a stored status. */
export type RadiologyWorkflowState = "awaiting_payment" | "pending_schedule" | "scheduled" | "in_progress" | "awaiting_report" | "completed" | "cancelled";

export function deriveWorkflowState(exam: RadiologyExam): RadiologyWorkflowState {
  if (exam.status === "cancelled") return "cancelled";
  if (exam.status === "completed") return "completed";
  if (exam.status === "awaiting_payment") return "awaiting_payment";
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
  // "patient": the same patient elsewhere; "device": the device is booked.
  resource?: "patient" | "device";
};

export type ImagingDevice = {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  modality: { id: string; code: string; nameFr: string } | null;
};

// Extra fields of GET /api/v1/radiology/[id] (the worklist does not carry them).
export type RadiologyExamDetail = RadiologyExam & {
  device: { code: string; label: string } | null;
  viewerUrl: string | null;
};

export type UserRef = {
  id: string;
  fullName: string;
};
