import prisma from "@/lib/prisma";
import { Dhis2MetricValue } from "./types";

/** A DHIS2 period in "YYYYMM" form, e.g. "202607". */
export type Dhis2Period = string;

export function periodToDateRange(period: Dhis2Period): { start: Date; end: Date } {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

/** Previous full calendar month, as a DHIS2 "YYYYMM" period, relative to `now`. */
export function previousMonthPeriod(now: Date = new Date()): Dhis2Period {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based; subtracting 1 from calendar month gives previous month
  const prev = new Date(Date.UTC(year, month - 1, 1));
  return `${prev.getUTCFullYear()}${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function computeMonthlyIndicators(period: Dhis2Period): Promise<Dhis2MetricValue[]> {
  const { start, end } = periodToDateRange(period);
  const admissionDate = { gte: start, lt: end };

  const [
    admissionsTotal,
    admissionsEmergency,
    admissionsScheduled,
    admissionsOutpatient,
    dischargesTotal,
    deathsFromStays,
    deathsWithoutStay,
    surgeriesCompleted,
    labExamsCompleted,
    radiologyExamsCompleted,
    drugsDispensedCount,
  ] = await Promise.all([
    prisma.stay.count({ where: { admissionDate } }),
    prisma.stay.count({ where: { admissionDate, type: "emergency" } }),
    prisma.stay.count({ where: { admissionDate, type: "scheduled" } }),
    prisma.stay.count({ where: { admissionDate, type: "outpatient" } }),
    prisma.stay.count({ where: { dischargeDate: { gte: start, lt: end } } }),
    prisma.stay.count({
      where: { status: "deceased", dischargeDate: { gte: start, lt: end } },
    }),
    prisma.patient.count({
      where: { isDeceased: true, deceasedAt: { gte: start, lt: end }, stays: { none: {} } },
    }),
    prisma.surgicalProcedure.count({ where: { status: "completed", endedAt: { gte: start, lt: end } } }),
    prisma.examResult.count({
      where: { validatedAt: { gte: start, lt: end }, request: { type: "biology" } },
    }),
    prisma.examResult.count({
      where: { validatedAt: { gte: start, lt: end }, request: { type: "radiology" } },
    }),
    prisma.drugDispensing.count({
      where: { status: { in: ["dispensed", "administered"] }, dispensedAt: { gte: start, lt: end } },
    }),
  ]);

  return [
    { metricKey: "admissions_total", value: admissionsTotal },
    { metricKey: "admissions_emergency", value: admissionsEmergency },
    { metricKey: "admissions_scheduled", value: admissionsScheduled },
    { metricKey: "admissions_outpatient", value: admissionsOutpatient },
    { metricKey: "discharges_total", value: dischargesTotal },
    { metricKey: "deaths_total", value: deathsFromStays + deathsWithoutStay },
    { metricKey: "surgeries_completed", value: surgeriesCompleted },
    { metricKey: "lab_exams_completed", value: labExamsCompleted },
    { metricKey: "radiology_exams_completed", value: radiologyExamsCompleted },
    { metricKey: "drugs_dispensed_count", value: drugsDispensedCount },
  ];
}
