import prisma from "@/lib/prisma";
import { buildHivReport, type Rma3HivReport } from "@/lib/hiv/rma3-hiv";

// Loads the program records the HIV / PMTCT / hepatitis / STI tables need: the month, plus
// the history that decides "already known positive", the ART follow-up and the PCR order.

const DAY = 86_400_000;
const person = { select: { birthDate: true, gender: true } } as const;

export async function computeHivReport(tenantId: string, start: Date, end: Date): Promise<Rma3HivReport> {
  const [tests, enrolments, pregnancies, infants, viralLoads, hepatitis, tbCases] = await Promise.all([
    prisma.screeningTest.findMany({
      where: { tenantId, testedAt: { lt: end } },
      select: {
        patientId: true,
        testType: true,
        testedAt: true,
        result: true,
        entryPoint: true,
        isRetest: true,
        resultCollectedAt: true,
        pregnancyId: true,
        partnerOfPregnancyId: true,
        referralSource: true,
        treatedAt: true,
        patient: person,
      },
    }),
    prisma.hivCareEnrolment.findMany({
      where: { tenantId, enrolledAt: { lt: end } },
      select: {
        patientId: true,
        hivDiagnosisDate: true,
        artStartDate: true,
        enrolledAt: true,
        entryPoint: true,
        transferIn: true,
        pregnancyId: true,
        status: true,
        statusChangedAt: true,
        transferOut: true,
        patient: person,
        visits: { where: { visitDate: { lt: end } }, orderBy: [{ visitDate: "asc" }, { createdAt: "asc" }] },
      },
    }),
    // Pregnancies that overlap the month (first visit, delivery, pregnant at a visit…).
    prisma.pregnancy.findMany({
      where: { tenantId, lastMenstrualPeriod: { lt: end }, expectedDueDate: { gte: new Date(start.getTime() - 120 * DAY) } },
      select: {
        id: true,
        patientId: true,
        lastMenstrualPeriod: true,
        expectedDueDate: true,
        referralSource: true,
        pmtctStatus: { select: { hivKnownPositiveAtEntry: true, onArtAtEntry: true, hbvKnownPositiveAtEntry: true } },
        patient: person,
        antenatalVisits: { orderBy: { visitDate: "asc" }, take: 1, select: { visitDate: true } },
        delivery: { select: { deliveryDate: true, newborns: { select: { outcome: true } } } },
      },
    }),
    prisma.hivExposedInfant.findMany({
      where: { tenantId },
      select: { patientId: true, bornInFacility: true, firstSeenAt: true, nevirapineStartedAt: true, cotrimoxazoleStartedAt: true, visit6to8WeeksAt: true, patient: person },
    }),
    prisma.viralLoadResult.findMany({
      where: { tenantId, sampledAt: { lt: end } },
      select: { patientId: true, program: true, sampledAt: true, value: true, belowDetection: true, pregnancyId: true, patient: person },
    }),
    prisma.hepatitisCase.findMany({
      where: { tenantId, diagnosedAt: { lt: end } },
      select: {
        patientId: true,
        type: true,
        diagnosedAt: true,
        deltaPositive: true,
        eligibleAt: true,
        treatmentStartedAt: true,
        treatmentStoppedAt: true,
        curedAt: true,
        cirrhosisAt: true,
        liverCancerAt: true,
        diedAt: true,
        patient: person,
      },
    }),
    prisma.tbCase.findMany({ where: { tenantId, notificationDate: { lt: end } }, select: { patientId: true, notificationDate: true, outcomeDate: true } }),
  ]);

  return buildHivReport({
    start,
    end,
    tests,
    enrolments,
    pregnancies: pregnancies.map(({ antenatalVisits, delivery, pmtctStatus, ...p }) => ({
      ...p,
      hivKnownPositiveAtEntry: pmtctStatus?.hivKnownPositiveAtEntry ?? false,
      onArtAtEntry: pmtctStatus?.onArtAtEntry ?? false,
      hbvKnownPositiveAtEntry: pmtctStatus?.hbvKnownPositiveAtEntry ?? false,
      firstVisitDate: antenatalVisits[0]?.visitDate ?? null,
      deliveryDate: delivery?.deliveryDate ?? null,
      newbornsAlive: delivery?.newborns.filter((n) => n.outcome === "alive").length ?? 0,
    })),
    infants,
    viralLoads,
    hepatitis,
    tbCases,
  });
}
