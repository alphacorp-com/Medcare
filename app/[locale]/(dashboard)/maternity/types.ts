export type PregnancyStatus = "ongoing" | "delivered" | "miscarried" | "terminated";
export type DeliveryMode = "vaginal" | "assisted_vaginal" | "cesarean";
export type Gender = "M" | "F" | "U";

export type PatientRef = {
  id: string;
  firstName: string;
  lastName: string;
  ipp: string;
  birthDate?: string;
};

export type PregnancyListItem = {
  id: string;
  patientId: string;
  patient: PatientRef;
  lastMenstrualPeriod: string;
  expectedDueDate: string;
  gravida: number;
  para: number;
  status: PregnancyStatus;
  antenatalVisits: { id: string; visitDate: string; visitNumber: number }[];
  delivery: { id: string; deliveryDate: string | null } | null;
};

export type AntenatalVisit = {
  id: string;
  pregnancyId: string;
  visitNumber: number;
  visitDate: string;
  gestationalAgeWeeks: number;
  performedById: string;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  weight: string | null;
  fundalHeightCm: string | null;
  fetalHeartRate: number | null;
  ironFolateGiven: boolean;
  tetanusVaccineGiven: boolean;
  malariaPreventionGiven: boolean;
  notes: string | null;
};

export type PtmeExamResult = { id: string; isCritical: boolean; validatedAt: string | null; resultData: unknown };
export type PtmeExam = {
  id: string;
  examLabel: string;
  status: string;
  requestedAt: string;
  results: PtmeExamResult[];
};

export type PartographEntry = {
  id: string;
  deliveryId: string;
  recordedAt: string;
  cervicalDilationCm: number | null;
  fetalHeartRate: number | null;
  contractionsPer10Min: number | null;
  contractionDurationSec: number | null;
  maternalPulse: number | null;
  maternalBpSystolic: number | null;
  maternalBpDiastolic: number | null;
  amnioticFluid: string | null;
};

export type Newborn = {
  id: string;
  deliveryId: string;
  patientId: string | null;
  patient: PatientRef | null;
  sex: Gender;
  birthWeightGrams: number | null;
  apgarScore1Min: number | null;
  apgarScore5Min: number | null;
  vitaminKGiven: boolean;
  resuscitationNeeded: boolean;
  outcome: string;
  notes: string | null;
};

export type Delivery = {
  id: string;
  pregnancyId: string;
  stayId: string | null;
  deliveryDate: string | null;
  mode: DeliveryMode | null;
  attendedById: string | null;
  complications: unknown;
  maternalOutcome: string | null;
  placentaDelivered: boolean;
  bloodLossMl: number | null;
  notes: string | null;
  partograph: PartographEntry[];
  newborns: Newborn[];
};

export type PregnancyDetail = {
  id: string;
  patientId: string;
  patient: PatientRef;
  lastMenstrualPeriod: string;
  expectedDueDate: string;
  gravida: number;
  para: number;
  status: PregnancyStatus;
  riskFactors: unknown;
  notes: string | null;
  antenatalVisits: AntenatalVisit[];
  examRequests: PtmeExam[];
  delivery: Delivery | null;
};

export type NewPregnancyForm = {
  patientId: string;
  lastMenstrualPeriod: string;
  gravida: string;
  para: string;
  riskFactors: string;
  notes: string;
};

export type UserRef = { id: string; fullName: string };

export function gestationalAgeFromLmp(lmp: string, atDate: Date = new Date()): number {
  const lmpDate = new Date(lmp);
  const days = Math.floor((atDate.getTime() - lmpDate.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(days / 7);
}
