import prisma from "@/lib/prisma";
import type { ActivityTable } from "@/lib/reports/activity-rows";
import { pregnancySelect, toPeriod } from "@/lib/reports/rma3-activity-data";
import { buildProgramTables } from "@/lib/reports/rma3-programs";

// Loads the records of the malaria complements, oxygen, nutrition, blood bank and staff
// register for the RMA3 (rma3-programs.ts). Every query is scoped to the facility.

const person = { select: { birthDate: true, gender: true } } as const;

export async function computeProgramTables(tenantId: string, start: Date, end: Date): Promise<ActivityTable[]> {
  const month = { gte: start, lt: end };
  const [malariaCases, itnVisits, equipment, episodes, nutritionCases, growthVisits, donations, mobileSessions, staff, positiveDonors] = await Promise.all([
    prisma.malariaCase.findMany({
      where: { tenantId, diagnosedAt: month },
      select: {
        id: true,
        diagnosedAt: true,
        testType: true,
        result: true,
        severity: true,
        species: true,
        treatment: true,
        treatedWithAct: true,
        hospitalized: true,
        freeOfCharge: true,
        isPregnantAtDiagnosis: true,
        patient: person,
      },
    }),
    prisma.antenatalVisit.findMany({ where: { tenantId, visitDate: month, itnGiven: true }, select: { visitDate: true, pregnancy: { select: { patientId: true } } } }),
    prisma.biomedicalEquipment.findMany({ where: { tenantId }, select: { type: true, status: true } }),
    prisma.hypoxemiaEpisode.findMany({
      where: { tenantId, OR: [{ detectedAt: month }, { outcomeAt: month }] },
      select: {
        id: true,
        patientId: true,
        detectedAt: true,
        spo2: true,
        respiratoryDistress: true,
        deliveryRoom: true,
        oxygenGiven: true,
        outcome: true,
        outcomeAt: true,
        patient: { select: { birthDate: true, gender: true, pregnancies: pregnancySelect } },
      },
    }),
    // Open at some point of the month: admitted before its end, not discharged before its start.
    prisma.nutritionCase.findMany({
      where: { tenantId, admittedAt: { lt: end }, OR: [{ exitedAt: null }, { exitedAt: { gte: start } }] },
      select: { id: true, program: true, admittedAt: true, admissionType: true, residency: true, hivTested: true, anjeCounseling: true, exitedAt: true, exitReason: true, patient: person },
    }),
    prisma.growthMonitoringVisit.findMany({
      where: { tenantId, visitDate: month },
      select: { patientId: true, visitDate: true, weightKg: true, receivesWater: true, complementaryFood: true, stillBreastfed: true, multivitaminGiven: true, patient: person },
    }),
    prisma.bloodDonation.findMany({
      where: { tenantId, OR: [{ collectedAt: month }, { servedAt: month }, { transfusedAt: month }, { destroyedAt: month }] },
      select: {
        id: true,
        donorId: true,
        sessionId: true,
        collectedAt: true,
        hivResult: true,
        hbvResult: true,
        hcvResult: true,
        syphilisResult: true,
        servedAt: true,
        transfusedAt: true,
        destroyedAt: true,
        donor: { select: { donorType: true } },
      },
    }),
    prisma.bloodCollectionSession.findMany({ where: { tenantId, heldAt: month }, select: { id: true, heldAt: true } }),
    prisma.staffMember.findMany({ where: { tenantId }, select: { cadre: true, sex: true, payer: true, inPost: true, hiredAt: true, retirementDate: true, leftAt: true } }),
    // HIV-positive donors with a patient file: did they start ART this month?
    prisma.bloodDonor.findMany({
      where: { tenantId, patientId: { not: null }, donations: { some: { hivResult: "positive" } } },
      select: { patientId: true },
    }),
  ]);

  // Earlier donations of each donor of the month (to tell a "fidélisé" donor).
  const donorIds = [...new Set(donations.map((d) => d.donorId))];
  const history = donorIds.length
    ? await prisma.bloodDonation.findMany({ where: { tenantId, donorId: { in: donorIds } }, select: { donorId: true, collectedAt: true } })
    : [];
  const donorsStartedOnArt = positiveDonors.length
    ? await prisma.hivCareEnrolment.count({ where: { tenantId, patientId: { in: positiveDonors.map((d) => d.patientId!) }, artStartDate: month } })
    : 0;

  return buildProgramTables({
    start,
    end,
    malariaCases,
    itnVisits: itnVisits.map((v) => ({ patientId: v.pregnancy.patientId, visitDate: v.visitDate })),
    equipment,
    episodes: episodes.map(({ patient, ...e }) => ({ ...e, patient: { birthDate: patient.birthDate, gender: patient.gender }, pregnancies: patient.pregnancies.map(toPeriod) })),
    nutritionCases,
    growthVisits: growthVisits.map((v) => ({ ...v, weightKg: v.weightKg === null ? null : Number(v.weightKg) })),
    donations: donations.map(({ donor, ...d }) => ({
      ...d,
      donorType: donor.donorType,
      previousDonations: history.filter((h) => h.donorId === d.donorId && h.collectedAt < d.collectedAt).length,
    })),
    mobileSessions,
    donorsStartedOnArt,
    staff,
  });
}
