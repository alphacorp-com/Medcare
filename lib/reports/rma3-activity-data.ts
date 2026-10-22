import prisma from "@/lib/prisma";
import { buildActivityTables, type ActivityTable, type PregnancyPeriod } from "@/lib/reports/rma3-activity";

// Loads the clinical activity the RMA3 activity tables need (rma3-activity.ts): the month,
// plus the history that decides ranks (antenatal visits of the pregnancy), pregnancy at the
// date of an event and peri-operative deaths.

const DAY = 86_400_000;
const PERIOPERATIVE_WINDOW_DAYS = 30;
const person = { select: { birthDate: true, gender: true } } as const;
export const pregnancySelect = {
  select: { lastMenstrualPeriod: true, expectedDueDate: true, status: true, endedAt: true, updatedAt: true, delivery: { select: { deliveryDate: true } } },
} as const;

interface PregnancyRecord {
  lastMenstrualPeriod: Date;
  expectedDueDate: Date;
  status: string;
  endedAt: Date | null;
  updatedAt: Date;
  delivery: { deliveryDate: Date | null } | null;
}

// The end of a pregnancy: its delivery, the end date of a miscarriage / termination (or, for
// records made before that date existed, its last update), or the expected due date.
export function toPeriod(p: PregnancyRecord): PregnancyPeriod {
  const endedAt = p.delivery?.deliveryDate ?? (p.status === "miscarried" || p.status === "terminated" ? (p.endedAt ?? p.updatedAt) : p.expectedDueDate);
  return { lastMenstrualPeriod: p.lastMenstrualPeriod, endedAt };
}

export async function computeActivityTables(tenantId: string, start: Date, end: Date, tbHivOnArtPatientIds: readonly string[]): Promise<ActivityTable[]> {
  const month = { gte: start, lt: end };
  const asOf = new Date(Math.min(end.getTime(), Date.now()));
  const patientWithPregnancies = { select: { birthDate: true, gender: true, pregnancies: pregnancySelect } } as const;

  const [antenatalVisits, deliveries, newborns, deceasedWomen, stays, deceasedOutsideStay, surgeries, malariaCases, tbCases, bloodPressures, recordedMaternalDeaths] = await Promise.all([
    prisma.antenatalVisit.findMany({
      where: { tenantId, visitDate: { lt: end }, pregnancy: { antenatalVisits: { some: { visitDate: month } } } },
      select: {
        pregnancyId: true,
        visitNumber: true,
        visitDate: true,
        gestationalAgeWeeks: true,
        bloodPressureSystolic: true,
        bloodPressureDiastolic: true,
        ironFolateGiven: true,
        malariaPreventionGiven: true,
        pregnancy: { select: { patientId: true, patient: person } },
      },
    }),
    prisma.delivery.findMany({
      where: { tenantId, deliveryDate: month },
      select: {
        deliveryDate: true,
        mode: true,
        complications: true,
        maternalOutcome: true,
        stay: { select: { dischargeDate: true } },
        pregnancy: { select: { patientId: true, patient: person } },
      },
    }),
    prisma.newborn.findMany({
      where: { tenantId, delivery: { deliveryDate: month } },
      select: { id: true, sex: true, outcome: true, delivery: { select: { deliveryDate: true } } },
    }),
    prisma.patient.findMany({
      where: { tenantId, isDeceased: true, deceasedAt: month, pregnancies: { some: {} } },
      select: { id: true, deceasedAt: true, birthDate: true, gender: true, pregnancies: pregnancySelect },
    }),
    // Stays admitted, hospitalized or discharged in the month, or still open during it.
    prisma.stay.findMany({
      where: {
        tenantId,
        OR: [
          { admissionDate: month },
          { hospitalizedAt: { lt: end }, OR: [{ dischargeDate: null }, { dischargeDate: { gte: start } }] },
          { dischargeDate: month },
        ],
      },
      select: {
        id: true,
        patientId: true,
        admissionDate: true,
        consultationStatus: true,
        hospitalizedAt: true,
        dischargeDate: true,
        status: true,
        patient: patientWithPregnancies,
      },
    }),
    // Deaths recorded on the patient only (no stay), as in the DHIS2 monthly total.
    prisma.patient.findMany({
      where: { tenantId, isDeceased: true, deceasedAt: month, stays: { none: {} } },
      select: { id: true, deceasedAt: true, birthDate: true, gender: true, pregnancies: pregnancySelect },
    }),
    prisma.surgicalProcedure.findMany({
      where: { tenantId, status: "completed", endedAt: { gte: new Date(start.getTime() - PERIOPERATIVE_WINDOW_DAYS * DAY), lt: end } },
      select: { id: true, patientId: true, endedAt: true, patient: person },
    }),
    prisma.malariaCase.findMany({
      where: { tenantId, diagnosedAt: month },
      select: { id: true, patientId: true, diagnosedAt: true, testType: true, result: true, severity: true, isPregnantAtDiagnosis: true, patient: person },
    }),
    prisma.tbCase.findMany({
      where: { tenantId, OR: [{ notificationDate: month }, { treatmentStartDate: month }, { followUps: { some: { followUpDate: month } } }] },
      select: {
        id: true,
        patientId: true,
        notificationDate: true,
        caseType: true,
        classification: true,
        hivStatus: true,
        treatmentStartDate: true,
        patient: person,
        followUps: { where: { followUpDate: month, sputumResult: { not: "not_done" } }, select: { followUpDate: true } },
      },
    }),
    prisma.vitalSigns.findMany({
      where: { tenantId, recordedAt: month, bloodPressureSystolic: { not: null }, bloodPressureDiastolic: { not: null } },
      select: { patientId: true, recordedAt: true, patient: person },
    }),
    prisma.pregnancy.findMany({
      where: { tenantId, maternalDeathAt: month },
      select: { patientId: true, maternalDeathAt: true, patient: person },
    }),
  ]);

  const deceasedStays = stays.filter((s) => s.status === "deceased" && s.dischargeDate && s.dischargeDate >= start && s.dischargeDate < end);

  return buildActivityTables({
    start,
    end,
    asOf,
    antenatalVisits: antenatalVisits.map(({ pregnancy, bloodPressureSystolic, bloodPressureDiastolic, ...v }) => ({
      ...v,
      patientId: pregnancy.patientId,
      patient: pregnancy.patient,
      bloodPressureMeasured: bloodPressureSystolic !== null && bloodPressureDiastolic !== null,
    })),
    deliveries: deliveries.map((d) => ({
      patientId: d.pregnancy.patientId,
      deliveryDate: d.deliveryDate!,
      mode: d.mode,
      complications: Array.isArray(d.complications) ? d.complications.filter((c): c is string => typeof c === "string") : [],
      maternalOutcome: d.maternalOutcome,
      hasStay: d.stay !== null,
      stayDischargeDate: d.stay?.dischargeDate ?? null,
      patient: d.pregnancy.patient,
    })),
    newborns: newborns.map((n) => ({ id: n.id, sex: n.sex, outcome: n.outcome, deliveryDate: n.delivery.deliveryDate! })),
    deceasedWomen: deceasedWomen.map((w) => ({
      patientId: w.id,
      deceasedAt: w.deceasedAt!,
      patient: { birthDate: w.birthDate, gender: w.gender },
      pregnancies: w.pregnancies.map(toPeriod),
    })),
    stays: stays.map(({ patient, ...s }) => ({
      ...s,
      patient: { birthDate: patient.birthDate, gender: patient.gender },
      pregnancies: patient.pregnancies.map(toPeriod),
    })),
    deaths: [
      ...deceasedStays.map((s) => ({
        id: s.id,
        patientId: s.patientId,
        diedAt: s.dischargeDate!,
        patient: { birthDate: s.patient.birthDate, gender: s.patient.gender },
        pregnancies: s.patient.pregnancies.map(toPeriod),
      })),
      ...deceasedOutsideStay.map((p) => ({
        id: p.id,
        patientId: p.id,
        diedAt: p.deceasedAt!,
        patient: { birthDate: p.birthDate, gender: p.gender },
        pregnancies: p.pregnancies.map(toPeriod),
      })),
    ],
    surgeries: surgeries.map((s) => ({ ...s, endedAt: s.endedAt! })),
    malariaCases,
    tbCases: tbCases.map(({ followUps, ...c }) => ({ ...c, labFollowUpDates: followUps.map((f) => f.followUpDate) })),
    tbHivOnArtPatientIds: new Set(tbHivOnArtPatientIds),
    bloodPressures,
    recordedMaternalDeaths: recordedMaternalDeaths.map((p) => ({ patientId: p.patientId, at: p.maternalDeathAt!, patient: p.patient })),
  });
}
