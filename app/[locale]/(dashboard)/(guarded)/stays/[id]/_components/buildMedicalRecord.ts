import { format } from "date-fns";
import type { MedicalRecordData } from "@/components/templates/MedicalRecordTemplate";
import type { StayDetail } from "../types";

type Translate = (key: string) => string;

const fmt = (date: string | null | undefined) => (date ? format(new Date(date), "dd/MM/yyyy HH:mm") : null);
const byDateAsc = <T,>(items: T[], date: (item: T) => string) =>
  [...items].sort((a, b) => new Date(date(a)).getTime() - new Date(date(b)).getTime());
const toStrings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);

// Turns the admission (as returned by GET /api/v1/stays/:id) into the printable medical
// record. Only validated exam results are printed — a result still awaiting the
// biologist's / radiologist's sign-off appears as pending.
export function buildMedicalRecord(stay: StayDetail, ta: Translate, tm: Translate): MedicalRecordData {
  const name = (userId: string | null | undefined) => (userId ? stay.userNames[userId] ?? "—" : null);
  const vitals = stay.vitalSigns?.[0];

  return {
    patient: {
      fullName: `${stay.patient.lastName} ${stay.patient.firstName}`,
      ipp: stay.patient.ipp,
      birthDate: format(new Date(stay.patient.birthDate), "dd/MM/yyyy"),
      gender: tm(`gender_${stay.patient.gender}`),
      bloodGroup: stay.patient.bloodGroup,
      allergies: toStrings(stay.patient.allergies),
      chronicConditions: toStrings(stay.patient.chronicConditions),
    },
    stay: {
      number: stay.stayNumber,
      type: ta(`type_${stay.type}`),
      admissionDate: fmt(stay.admissionDate) ?? "",
      dischargeDate: fmt(stay.dischargeDate),
      reason: stay.admissionReason,
      act: stay.medicalAct?.label ?? null,
      attendingDoctor: name(stay.attendingDoctorId),
      hospitalization: stay.hospitalization
        ? [
            stay.hospitalization.departmentName,
            stay.hospitalization.bedLabel,
            stay.hospitalization.actLabel,
            stay.hospitalization.status === "admitted"
              ? `${tm("hospitalized_on")} ${fmt(stay.hospitalization.hospitalizedAt) ?? ""}`
              : tm("hospitalization_awaiting_payment"),
          ].filter(Boolean).join(" — ")
        : null,
      dischargeSummary: stay.dischargeSummary,
    },
    vitals: vitals
      ? [
          vitals.bloodPressureSystolic != null ? `TA ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic ?? "-"} mmHg` : null,
          vitals.pulse != null ? `FC ${vitals.pulse} bpm` : null,
          vitals.temperature != null ? `T ${vitals.temperature} °C` : null,
          vitals.spo2 != null ? `SpO2 ${vitals.spo2} %` : null,
          vitals.weight != null ? `${vitals.weight} kg` : null,
          vitals.height != null ? `${vitals.height} cm` : null,
        ].filter(Boolean).join(" · ")
      : null,
    notes: byDateAsc(stay.medicalRecords, (record) => record.createdAt).map((record) => ({
      date: fmt(record.createdAt) ?? "",
      type: tm(`note_${record.type}`) || record.type,
      title: record.title,
      author: name(record.authorId) ?? "—",
      content: record.content,
    })),
    prescriptions: byDateAsc(stay.prescriptions, (rx) => rx.prescribedAt).map((rx) => ({
      date: fmt(rx.prescribedAt) ?? "",
      prescriber: name(rx.prescriberId) ?? "—",
      items: rx.items ?? [],
    })),
    exams: byDateAsc(
      stay.examRequests.filter((exam) => exam.status !== "cancelled"),
      (exam) => exam.requestedAt
    ).map((exam) => {
      const result = exam.results?.[0];
      const validated = Boolean(result?.validatedAt);
      return {
        date: fmt(exam.requestedAt) ?? "",
        label: exam.examLabel,
        category: ta(`order_type_${exam.type}`),
        status: result && !validated ? tm("awaiting_validation") : ta(`exam_status_${exam.status}`),
        performer: validated ? name(result?.performerId) : null,
        validator: validated ? name(result?.validatedBy) : null,
        validatedAt: validated ? fmt(result?.validatedAt) : null,
        parameters: validated ? result?.resultData.parameters ?? [] : [],
        findings: validated ? result?.resultData.findings || null : null,
        impression: validated ? result?.resultData.impression || null : null,
      };
    }),
  };
}
