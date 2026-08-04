export const CHECKLIST_PHASES = ["signIn", "timeOut", "signOut"] as const;
export type ChecklistPhase = (typeof CHECKLIST_PHASES)[number];

/** Fixed WHO Surgical Safety Checklist items, trimmed to the essentials. */
export const CHECKLIST_ITEMS: Record<ChecklistPhase, string[]> = {
  signIn: [
    "patientIdentityConfirmed",
    "siteMarked",
    "anesthesiaSafetyCheck",
    "pulseOximeterFunctioning",
    "knownAllergyReviewed",
  ],
  timeOut: [
    "teamIntroduced",
    "patientProcedureSiteConfirmed",
    "antibioticProphylaxisGiven",
    "criticalStepsReviewed",
  ],
  signOut: [
    "procedureRecorded",
    "instrumentCountCorrect",
    "specimenLabeled",
    "equipmentIssuesAddressed",
  ],
};

export interface ChecklistPhaseState {
  items: Record<string, boolean>;
  completedAt?: string;
  completedBy?: string;
}

export type WhoChecklist = Partial<Record<ChecklistPhase, ChecklistPhaseState>>;

export function isPhaseComplete(phase: ChecklistPhase, state?: ChecklistPhaseState): boolean {
  if (!state?.items) return false;
  return CHECKLIST_ITEMS[phase].every((key) => state.items[key] === true);
}
