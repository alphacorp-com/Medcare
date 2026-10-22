// Client-safe check of a result redacted by lib/hiv/confidential-results (HIV result shown
// only to lab staff, prescribers and MODULE_HIV holders).
export function isConfidentialResult(resultData: unknown): boolean {
  return Boolean(resultData && typeof resultData === "object" && (resultData as { confidential?: unknown }).confidential === true);
}
