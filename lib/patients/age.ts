// Age-in-days snapshot stored on clinical events (immunization, malaria case) for display
// and clinical use. RMA3 reports do NOT bucket from it: they use the calendar age from
// Patient.birthDate (lib/reports/age-bands.ts), which a day count cannot reproduce exactly.
export function ageInDaysAt(birthDate: Date, eventDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((eventDate.getTime() - birthDate.getTime()) / msPerDay));
}
