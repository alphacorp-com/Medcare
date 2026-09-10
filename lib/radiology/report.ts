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
  criticalCommunication?: CriticalCommunication;
}
