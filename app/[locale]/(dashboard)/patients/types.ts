export type PatientRow = {
  id: string;
  ipp: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F" | "U";
  birthDate: string;
  bloodGroup: string | null;
  phone: string | null;
  email: string | null;
  isDeceased: boolean;
  createdAt: string;
};

export type NewPatientForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: "" | "M" | "F" | "U";
  nss: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
};

export const EMPTY_FORM: NewPatientForm = {
  firstName: "",
  lastName: "",
  birthDate: "",
  gender: "",
  nss: "",
  bloodGroup: "",
  phone: "",
  email: "",
  address: "",
  emergencyName: "",
  emergencyRelation: "",
  emergencyPhone: "",
};

export function ageFromBirthDate(iso: string): number {
  const b = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
