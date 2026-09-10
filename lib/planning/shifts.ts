export type ShiftType = "morning" | "afternoon" | "night" | "on_call" | "off";

export const SHIFT_TYPES: ShiftType[] = ["morning", "afternoon", "night", "on_call", "off"];

export type DepartmentType =
  | "emergency" | "surgery" | "icu" | "medicine" | "pediatrics"
  | "radiology" | "laboratory" | "pharmacy" | "admin" | "other";

export const DEPARTMENT_TYPES: DepartmentType[] = [
  "emergency", "surgery", "icu", "medicine", "pediatrics",
  "radiology", "laboratory", "pharmacy", "admin", "other",
];

/** Schedule.startTime/endTime are required @db.Time columns, so each shift type maps to a fixed range. */
export const SHIFT_TIME_RANGES: Record<ShiftType, { start: string; end: string }> = {
  morning: { start: "07:00", end: "15:00" },
  afternoon: { start: "15:00", end: "23:00" },
  night: { start: "23:00", end: "07:00" },
  on_call: { start: "00:00", end: "23:59" },
  // "off" is a placeholder record (not a real time slot) purely to note the person is off that day.
  off: { start: "00:00", end: "00:00" },
};

/** Prisma's @db.Time columns accept a Date; the calendar date component is ignored by Postgres. */
export function timeStringToDate(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

export function shiftTimeRange(shiftType: ShiftType): { startTime: Date; endTime: Date } {
  const range = SHIFT_TIME_RANGES[shiftType];
  return { startTime: timeStringToDate(range.start), endTime: timeStringToDate(range.end) };
}
