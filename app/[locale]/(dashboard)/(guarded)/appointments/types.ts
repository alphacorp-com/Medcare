export type AppointmentStatus = "booked" | "confirmed" | "checked_in" | "completed" | "no_show" | "cancelled";

export interface Doctor {
  id: string;
  fullName: string;
  specialty: string | null;
}

export interface AppointmentTypeOption {
  id: string;
  code: string;
  nameFr: string;
  nameEn: string | null;
  color: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string | null;
  appointmentTypeCode: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  reasonForVisit: string | null;
  notes: string | null;
  stayId: string | null;
  seriesId: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ipp: string;
  };
}

export interface AppointmentConflict {
  appointmentId?: string;
  scheduledAt?: string;
  patientName?: string;
  reason?: string;
}

export interface NewAppointmentForm {
  patientId: string;
  doctorId: string;
  appointmentTypeCode: string;
  scheduledAt: string;
  durationMinutes: string;
  reasonForVisit: string;
  notes: string;
  recurrenceFrequency: "" | "weekly" | "monthly";
  recurrenceOccurrences: string;
}
