import { endOfDay, startOfDay, subDays } from "date-fns";
import type { ExamType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  LIST_LIMIT,
  type AmountWidgetData,
  type ListWidgetData,
  type StatWidgetData,
  type WidgetData,
} from "@/lib/dashboard/widget-data";

// Server-side data loaders for the generic dashboard widgets, keyed by widget id.
// Callers MUST check canViewWidget() first — loaders assume the permission check passed
// and only scope by tenant (and by the caller's own id for "my …" widgets). Both ids
// come from the session, never from the request.

export interface LoaderContext {
  tenantId: string;
  userId: string;
}

type Loader = (ctx: LoaderContext) => Promise<WidgetData>;

// "Today" is the server's local day. On-prem installs run in the facility's timezone;
// a server in another timezone would shift these windows.
function todayRange() {
  const now = new Date();
  return { gte: startOfDay(now), lte: endOfDay(now) };
}

function patientName(patient: { firstName: string; lastName: string }): string {
  return `${patient.lastName} ${patient.firstName}`;
}

// Matches the laboratory module (GET /api/v1/laboratory lists biology only), so every
// count shown here is one the linked page can actually display.
const LAB_EXAM_TYPES: ExamType[] = ["biology"];

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;

// ── KPI tiles ───────────────────────────────────────────────────────────────

async function activeConsultations({ tenantId }: LoaderContext): Promise<StatWidgetData> {
  const value = await prisma.stay.count({ where: { tenantId, status: "in_progress" } });
  return { value, tone: "default" };
}

// Average current wait of emergency patients nobody has picked up yet, measured the same
// way as the patient queue (from triage, else from admission).
async function erWaitTime({ tenantId }: LoaderContext): Promise<StatWidgetData> {
  const waiting = await prisma.stay.findMany({
    where: { tenantId, status: "in_progress", type: "emergency", consultationStatus: "waiting" },
    select: { triagedAt: true, admissionDate: true },
  });
  const now = Date.now();
  const value =
    waiting.length === 0
      ? 0
      : Math.round(
          waiting.reduce((sum, s) => sum + (now - (s.triagedAt ?? s.admissionDate).getTime()), 0) /
            waiting.length /
            60_000
        );
  return { value, unit: "minutes", tone: value > 60 ? "critical" : value > 15 ? "warning" : "success" };
}

async function admissionsToday({ tenantId }: LoaderContext): Promise<StatWidgetData> {
  const value = await prisma.stay.count({ where: { tenantId, admissionDate: todayRange() } });
  return { value, tone: "default" };
}

async function bedOccupancy({ tenantId }: LoaderContext): Promise<StatWidgetData> {
  const groups = await prisma.bed.groupBy({
    by: ["status"],
    where: { tenantId, isActive: true },
    _count: true,
  });
  const total = groups.reduce((sum, g) => sum + g._count, 0);
  const value = groups.find((g) => g.status === "occupied")?._count ?? 0;
  const ratio = total > 0 ? value / total : 0;
  return { value, total, tone: ratio > 0.9 ? "critical" : ratio > 0.75 ? "warning" : "default" };
}

async function appointmentsToday({ tenantId }: LoaderContext): Promise<StatWidgetData> {
  const value = await prisma.appointment.count({
    where: { tenantId, scheduledAt: todayRange(), status: { notIn: ["cancelled", "no_show"] } },
  });
  return { value, tone: "default" };
}

async function pendingLabs({ tenantId }: LoaderContext): Promise<StatWidgetData> {
  const value = await prisma.examRequest.count({
    where: { tenantId, status: "requested", type: { in: LAB_EXAM_TYPES } },
  });
  return { value, tone: value > 10 ? "warning" : "default" };
}

const UNPAID_STATUSES = ["pending_payment", "partially_paid"] as const;

// Outstanding = the patient's share minus what they already paid (same rule as
// lib/billing/applyPayment.ts), summed per currency.
async function unpaidInvoices({ tenantId }: LoaderContext): Promise<AmountWidgetData> {
  const groups = await prisma.patientInvoice.groupBy({
    by: ["currency"],
    where: { tenantId, status: { in: [...UNPAID_STATUSES] } },
    _sum: { patientAmount: true, paidAmount: true },
    _count: true,
  });
  const count = groups.reduce((sum, g) => sum + g._count, 0);
  return {
    count,
    amounts: groups.map((g) => ({
      currency: g.currency,
      value: Number(g._sum.patientAmount ?? 0) - Number(g._sum.paidAmount ?? 0),
    })),
    tone: count > 0 ? "warning" : "success",
  };
}

async function paymentsToday({ tenantId }: LoaderContext): Promise<AmountWidgetData> {
  const groups = await prisma.payment.groupBy({
    by: ["currency"],
    where: { tenantId, status: "successful", completedAt: todayRange() },
    _sum: { amount: true },
    _count: true,
  });
  return {
    count: groups.reduce((sum, g) => sum + g._count, 0),
    amounts: groups.map((g) => ({ currency: g.currency, value: Number(g._sum.amount ?? 0) })),
    tone: "default",
  };
}

// ── Personal panels ─────────────────────────────────────────────────────────

async function myInpatients({ tenantId, userId }: LoaderContext): Promise<ListWidgetData> {
  const where: Prisma.StayWhereInput = { tenantId, status: "in_progress", attendingDoctorId: userId };
  const [stays, total] = await Promise.all([
    prisma.stay.findMany({
      where,
      select: { id: true, stayNumber: true, type: true, admissionDate: true, triageAcuity: true, patient: { select: PATIENT_SELECT } },
      orderBy: { admissionDate: "asc" },
      take: LIST_LIMIT,
    }),
    prisma.stay.count({ where }),
  ]);
  return {
    total,
    viewAllHref: "/stays",
    items: stays.map((s) => ({
      id: s.id,
      title: patientName(s.patient),
      subtitle: `#${s.patient.ipp} · ${s.stayNumber}`,
      timestamp: s.admissionDate.toISOString(),
      badge: { key: `stay_${s.type}`, tone: s.type === "emergency" ? "warning" : "default" },
      href: `/stays/${s.id}`,
    })),
  };
}

async function myAppointmentsToday({ tenantId, userId }: LoaderContext): Promise<ListWidgetData> {
  const where: Prisma.AppointmentWhereInput = {
    tenantId,
    doctorId: userId,
    scheduledAt: todayRange(),
    status: { notIn: ["cancelled"] },
  };
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      select: { id: true, scheduledAt: true, status: true, reasonForVisit: true, patient: { select: PATIENT_SELECT } },
      orderBy: { scheduledAt: "asc" },
      take: LIST_LIMIT,
    }),
    prisma.appointment.count({ where }),
  ]);
  return {
    total,
    viewAllHref: "/appointments",
    items: appointments.map((a) => ({
      id: a.id,
      title: patientName(a.patient),
      subtitle: a.reasonForVisit ?? undefined,
      timestamp: a.scheduledAt.toISOString(),
      badge: {
        key: `appointment_${a.status}`,
        tone: a.status === "checked_in" ? "success" : a.status === "no_show" ? "critical" : "default",
      },
      href: `/appointments?appointment=${a.id}`,
    })),
  };
}

// Results validated in the last 7 days on exams the caller prescribed.
async function myRecentResults({ tenantId, userId }: LoaderContext): Promise<ListWidgetData> {
  const where: Prisma.ExamResultWhereInput = {
    tenantId,
    validatedAt: { gte: subDays(new Date(), 7) },
    request: { prescriberId: userId, type: { in: LAB_EXAM_TYPES } },
  };
  const [results, total] = await Promise.all([
    prisma.examResult.findMany({
      where,
      select: {
        id: true,
        validatedAt: true,
        isCritical: true,
        patient: { select: PATIENT_SELECT },
        request: { select: { id: true, examLabel: true } },
      },
      // Critical results first, then most recent.
      orderBy: [{ isCritical: "desc" }, { validatedAt: "desc" }],
      take: LIST_LIMIT,
    }),
    prisma.examResult.count({ where }),
  ]);
  return {
    total,
    viewAllHref: "/laboratory",
    items: results.map((r) => ({
      id: r.id,
      title: patientName(r.patient),
      subtitle: r.request.examLabel,
      timestamp: r.validatedAt?.toISOString(),
      badge: r.isCritical ? { key: "critical", tone: "critical" } : undefined,
      href: `/laboratory?exam=${r.request.id}`,
    })),
  };
}

// ── Facility-wide work queues ───────────────────────────────────────────────

// Exams waiting to be performed: not yet started, or started but with no result entered.
function examsToPerform(types: ExamType[], viewAllHref: string) {
  return async ({ tenantId }: LoaderContext): Promise<ListWidgetData> => {
    const where: Prisma.ExamRequestWhereInput = {
      tenantId,
      type: { in: types },
      status: { in: ["requested", "scheduled", "in_progress"] },
      results: { none: { validatedAt: null } },
    };
    return listExamRequests(where, viewAllHref);
  };
}

// Exams with an entered result/report awaiting sign-off — the same condition the
// laboratory/radiology validate routes check before accepting a validation.
function examsToValidate(types: ExamType[], viewAllHref: string) {
  return async ({ tenantId }: LoaderContext): Promise<ListWidgetData> => {
    const where: Prisma.ExamRequestWhereInput = {
      tenantId,
      type: { in: types },
      status: { notIn: ["cancelled", "completed"] },
      results: { some: { validatedAt: null } },
    };
    return listExamRequests(where, viewAllHref);
  };
}

async function listExamRequests(where: Prisma.ExamRequestWhereInput, viewAllHref: string): Promise<ListWidgetData> {
  const [exams, total] = await Promise.all([
    prisma.examRequest.findMany({
      where,
      select: {
        id: true,
        examLabel: true,
        urgency: true,
        requestedAt: true,
        patient: { select: PATIENT_SELECT },
        results: { where: { validatedAt: null }, select: { isCritical: true }, take: 1 },
      },
      // ExamUrgency is declared stat → urgent → routine, and Postgres sorts enums by
      // declaration order, so "asc" puts the most urgent first.
      orderBy: [{ urgency: "asc" }, { requestedAt: "asc" }],
      take: LIST_LIMIT,
    }),
    prisma.examRequest.count({ where }),
  ]);
  return {
    total,
    viewAllHref,
    items: exams.map((e) => {
      const isCritical = e.results[0]?.isCritical === true;
      return {
        id: e.id,
        title: patientName(e.patient),
        subtitle: e.examLabel,
        timestamp: e.requestedAt.toISOString(),
        badge: isCritical
          ? { key: "critical", tone: "critical" as const }
          : { key: `urgency_${e.urgency}`, tone: e.urgency === "routine" ? ("default" as const) : ("warning" as const) },
        href: `${viewAllHref}?exam=${e.id}`,
      };
    }),
  };
}

async function pharmacyPendingRx({ tenantId }: LoaderContext): Promise<ListWidgetData> {
  const where: Prisma.PrescriptionWhereInput = { tenantId, status: { in: ["pending", "validated"] } };
  const [prescriptions, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      select: { id: true, status: true, prescribedAt: true, patient: { select: PATIENT_SELECT } },
      orderBy: { prescribedAt: "asc" },
      take: LIST_LIMIT,
    }),
    prisma.prescription.count({ where }),
  ]);
  return {
    total,
    viewAllHref: "/pharmacy",
    items: prescriptions.map((p) => ({
      id: p.id,
      title: patientName(p.patient),
      subtitle: `#${p.patient.ipp}`,
      timestamp: p.prescribedAt.toISOString(),
      badge: { key: `rx_${p.status}`, tone: p.status === "validated" ? "success" : "warning" },
      href: `/pharmacy?rx=${p.id}`,
    })),
  };
}

async function unpaidInvoicesList({ tenantId }: LoaderContext): Promise<ListWidgetData> {
  const where: Prisma.PatientInvoiceWhereInput = { tenantId, status: { in: [...UNPAID_STATUSES] } };
  const [invoices, total] = await Promise.all([
    prisma.patientInvoice.findMany({
      where,
      select: {
        id: true,
        status: true,
        currency: true,
        patientAmount: true,
        paidAmount: true,
        createdAt: true,
        patient: { select: PATIENT_SELECT },
      },
      orderBy: { createdAt: "asc" },
      take: LIST_LIMIT,
    }),
    prisma.patientInvoice.count({ where }),
  ]);
  return {
    total,
    viewAllHref: "/billing",
    items: invoices.map((i) => ({
      id: i.id,
      title: patientName(i.patient),
      subtitle: `#${i.patient.ipp}`,
      timestamp: i.createdAt.toISOString(),
      amount: { currency: i.currency, value: Number(i.patientAmount) - Number(i.paidAmount) },
      badge: { key: `invoice_${i.status}`, tone: i.status === "partially_paid" ? "warning" : "default" },
      href: `/billing/${i.id}`,
    })),
  };
}

export const WIDGET_LOADERS: Record<string, Loader> = {
  "active-consultations": activeConsultations,
  "er-wait-time": erWaitTime,
  "admissions-today": admissionsToday,
  "bed-occupancy": bedOccupancy,
  "appointments-today": appointmentsToday,
  "pending-labs": pendingLabs,
  "unpaid-invoices": unpaidInvoices,
  "payments-today": paymentsToday,
  "my-inpatients": myInpatients,
  "my-appointments-today": myAppointmentsToday,
  "my-recent-results": myRecentResults,
  "lab-to-perform": examsToPerform(LAB_EXAM_TYPES, "/laboratory"),
  "lab-to-validate": examsToValidate(LAB_EXAM_TYPES, "/laboratory"),
  "radiology-to-perform": examsToPerform(["radiology"], "/radiology"),
  "radiology-to-validate": examsToValidate(["radiology"], "/radiology"),
  "pharmacy-pending-rx": pharmacyPendingRx,
  "unpaid-invoices-list": unpaidInvoicesList,
};
