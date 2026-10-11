import type { ResultParameter } from "@/lib/laboratory/results";

export interface CriticalCommunication {
  notifiedTo: string;
  method: string;
  notifiedAt: string;
}

/** ACR-style structured report: Technique / Findings / Impression, not a lab-style parameter table. */
export interface RadiologyReportData {
  technique: string;
  findings: string;
  impression: string;
  priorStudyIds?: string[];
  // Structured findings read against the exam's catalog parameters (organ by organ),
  // entered by the radiographer and signed off by the radiologist with the report.
  parameters?: ResultParameter[];
  criticalCommunication?: CriticalCommunication;
}
