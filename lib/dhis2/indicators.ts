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

export async function computeMonthlyIndicators(tenantId: string, period: Dhis2Period): Promise<Dhis2MetricValue[]> {
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
    ancFirstVisit,
    ancFourthVisitPlus,
    deliveriesTotal,
    deliveriesCesarean,
    tetanusDosesGiven,
    malariaPreventionDosesGiven,
    hivTestsPregnancyCompleted,
    newbornsTotal,
  ] = await Promise.all([
    prisma.stay.count({ where: { tenantId, admissionDate } }),
    prisma.stay.count({ where: { tenantId, admissionDate, type: "emergency" } }),
    prisma.stay.count({ where: { tenantId, admissionDate, type: "scheduled" } }),
    prisma.stay.count({ where: { tenantId, admissionDate, type: "outpatient" } }),
    prisma.stay.count({ where: { tenantId, dischargeDate: { gte: start, lt: end } } }),
    prisma.stay.count({
      where: { tenantId, status: "deceased", dischargeDate: { gte: start, lt: end } },
    }),
    prisma.patient.count({
      where: { tenantId, isDeceased: true, deceasedAt: { gte: start, lt: end }, stays: { none: {} } },
    }),
    prisma.surgicalProcedure.count({ where: { tenantId, status: "completed", endedAt: { gte: start, lt: end } } }),
    prisma.examResult.count({
      where: { validatedAt: { gte: start, lt: end }, request: { tenantId, type: "biology" } },
    }),
    prisma.examResult.count({
      where: { validatedAt: { gte: start, lt: end }, request: { tenantId, type: "radiology" } },
    }),
    prisma.drugDispensing.count({
      where: { tenantId, status: { in: ["dispensed", "administered"] }, dispensedAt: { gte: start, lt: end } },
    }),
    prisma.antenatalVisit.count({ where: { tenantId, visitDate: { gte: start, lt: end }, visitNumber: 1 } }),
    prisma.antenatalVisit.count({ where: { tenantId, visitDate: { gte: start, lt: end }, visitNumber: { gte: 4 } } }),
    prisma.delivery.count({ where: { tenantId, deliveryDate: { gte: start, lt: end } } }),
    prisma.delivery.count({ where: { tenantId, deliveryDate: { gte: start, lt: end }, mode: "cesarean" } }),
    prisma.antenatalVisit.count({
      where: { tenantId, visitDate: { gte: start, lt: end }, tetanusVaccineGiven: true },
    }),
    prisma.antenatalVisit.count({
      where: { tenantId, visitDate: { gte: start, lt: end }, malariaPreventionGiven: true },
    }),
    prisma.examResult.count({
      where: {
        validatedAt: { gte: start, lt: end },
        request: { tenantId, examCode: "HIV", pregnancyId: { not: null } },
      },
    }),
    prisma.newborn.count({ where: { tenantId, delivery: { deliveryDate: { gte: start, lt: end } } } }),
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
    { metricKey: "anc_first_visit", value: ancFirstVisit },
    { metricKey: "anc_fourth_visit_plus", value: ancFourthVisitPlus },
    { metricKey: "deliveries_total", value: deliveriesTotal },
    { metricKey: "deliveries_cesarean", value: deliveriesCesarean },
    { metricKey: "tetanus_doses_given", value: tetanusDosesGiven },
    { metricKey: "malaria_prevention_doses_given", value: malariaPreventionDosesGiven },
    { metricKey: "hiv_tests_pregnancy_completed", value: hivTestsPregnancyCompleted },
    { metricKey: "newborns_total", value: newbornsTotal },
  ];
}
