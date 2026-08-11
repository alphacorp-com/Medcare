// Age-in-days computation for clinical events (immunization, diagnosis, etc.)
// where the RMA3/DHIS2 age bracket varies by report section (0-11 vs 12-23 vs
// 12-59 months, etc.) — callers store the raw day count and bucket later.
export function ageInDaysAt(birthDate: Date, eventDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((eventDate.getTime() - birthDate.getTime()) / msPerDay));
}
