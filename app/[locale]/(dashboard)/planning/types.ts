export type ShiftType = "morning" | "afternoon" | "night" | "on_call" | "off";
export type ScheduleStatus = "planned" | "confirmed" | "modified" | "absent" | "replaced";
export type DepartmentType =
  | "emergency" | "surgery" | "icu" | "medicine" | "pediatrics"
  | "radiology" | "laboratory" | "pharmacy" | "admin" | "other";

export type ScheduleEntry = {
  id: string;
  userId: string;
  departmentId: string;
  shiftType: ShiftType;
  date: string;
  status: ScheduleStatus;
  replacedBy: string | null;
  notes: string | null;
};

export type StaffMember = {
  id: string;
  fullName: string;
  role: string;
  departmentId: string | null;
  isActive: boolean;
};

export type DepartmentRecord = {
  id: string;
  code: string;
  name: string;
  type: DepartmentType | null;
  headId: string | null;
  phone: string | null;
  location: string | null;
  isActive: boolean;
  _count: { users: number };
};

export type NewShiftForm = {
  userId: string;
  shiftType: ShiftType;
  date: string;
  notes: string;
};

export type ScheduleConflict = {
  scheduleId: string;
  shiftType: string;
  status: string;
};

export type DepartmentForm = {
  name: string;
  code: string;
  type: DepartmentType | "";
  headId: string;
  phone: string;
  location: string;
};
