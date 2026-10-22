import prisma from "@/lib/prisma";
import type { ActivityTable } from "@/lib/reports/activity-rows";
import { pregnancySelect, toPeriod } from "@/lib/reports/rma3-activity-data";
import { buildMotherChildTables, type BreastfeedingStart } from "@/lib/reports/rma3-mother-child";
import { TD_GROUP } from "@/lib/maternity/td";

// Loads the mother-and-child records the RMA3 complements need (rma3-mother-child.ts).

const person = { select: { birthDate: true, gender: true } } as const;

export async function computeMotherChildTables(tenantId: string, start: Date, end: Date): Promise<ActivityTable[]> {
  const month = { gte: start, lt: end };

  // The antigens of the TD group (the facility's catalog and the shared one).
  const tdAntigens = await prisma.referenceCatalogItem.findMany({
    where: { catalogType: "vaccine_antigen", OR: [{ tenantId }, { tenantId: null }], AND: [{ OR: [{ group: { equals: TD_GROUP, mode: "insensitive" } }, { code: TD_GROUP }] }] },
    select: { code: true },
  });

  const [antenatalVisits, tdDoses, deliveries, pregnancyEnds, maternalDeaths, postnatalVisits, newborns, fpVisits] = await Promise.all([
    prisma.antenatalVisit.findMany({
      where: { tenantId, visitDate: month },
      select: { visitDate: true, strategy: true, hemoglobinGPerDl: true, pregnancy: { select: { patientId: true, patient: person } } },
    }),
    prisma.immunization.findMany({
      where: { tenantId, administeredAt: month, antigenCode: { in: [TD_GROUP, ...tdAntigens.map((a) => a.code)] } },
      select: {
        patientId: true,
        administeredAt: true,
        doseNumber: true,
        antenatalVisit: { select: { id: true } },
        patient: { select: { birthDate: true, gender: true, pregnancies: pregnancySelect } },
      },
    }),
    prisma.delivery.findMany({
      where: { tenantId, deliveryDate: month },
      select: {
        deliveryDate: true,
        amtsl: true,
        complications: true,
        complicationsManaged: true,
        breastfeedingStart: true,
        pregnancy: { select: { patientId: true, patient: person } },
      },
    }),
    prisma.pregnancy.findMany({
      where: { tenantId, status: { in: ["miscarried", "terminated"] }, endedAt: month },
      select: { patientId: true, endedAt: true, abortionCare: true, patient: person },
    }),
    prisma.pregnancy.findMany({
      where: { tenantId, OR: [{ maternalDeathAt: month }, { maternalDeathReviewedAt: month }] },
      select: { patientId: true, maternalDeathAt: true, maternalDeathCause: true, maternalDeathReviewedAt: true, patient: person },
    }),
    prisma.postnatalVisit.findMany({
      where: { tenantId, visitDate: month },
      select: {
        visitDate: true,
        vitaminAGiven: true,
        ironFolateGiven: true,
        breastfeedingCounseling: true,
        newbornExamined: true,
        pregnancy: {
          select: {
            patientId: true,
            patient: person,
            delivery: { select: { deliveryDate: true, newborns: { select: { id: true, sex: true, outcome: true, diedAt: true } } } },
          },
        },
      },
    }),
    // Born, dead or reviewed this month.
    prisma.newborn.findMany({
      where: {
        tenantId,
        OR: [{ delivery: { deliveryDate: month } }, { diedAt: month }, { deathReviewedAt: month }, { patient: { deceasedAt: month } }],
      },
      select: {
        id: true,
        sex: true,
        outcome: true,
        birthWeightGrams: true,
        apgarScore5Min: true,
        bagMaskVentilation: true,
        kangarooCare: true,
        incubatorCare: true,
        stillbirthType: true,
        diedAt: true,
        deathCause: true,
        deathReviewedAt: true,
        delivery: { select: { deliveryDate: true, breastfeedingStart: true, pregnancy: { select: { lastMenstrualPeriod: true } } } },
        patient: { select: { isDeceased: true, deceasedAt: true } },
      },
    }),
    prisma.familyPlanningVisit.findMany({
      where: { tenantId, visitDate: month },
      select: {
        id: true,
        patientId: true,
        visitDate: true,
        clientStatus: true,
        counseled: true,
        methodCode: true,
        isPostpartum: true,
        referredByChw: true,
        patient: { select: { birthDate: true, gender: true, pregnancies: { select: { delivery: { select: { deliveryDate: true } } } } } },
      },
    }),
  ]);

  return buildMotherChildTables({
    start,
    end,
    antenatalVisits: antenatalVisits.map((v) => ({
      patientId: v.pregnancy.patientId,
      visitDate: v.visitDate,
      strategy: v.strategy,
      hemoglobinMeasured: v.hemoglobinGPerDl !== null,
      patient: v.pregnancy.patient,
    })),
    tdDoses: tdDoses.map((d) => ({
      patientId: d.patientId,
      at: d.administeredAt,
      doseNumber: d.doseNumber,
      fromAntenatalVisit: d.antenatalVisit !== null,
      patient: { birthDate: d.patient.birthDate, gender: d.patient.gender },
      pregnancies: d.patient.pregnancies.map(toPeriod),
    })),
    deliveries: deliveries.map((d) => ({
      patientId: d.pregnancy.patientId,
      deliveryDate: d.deliveryDate!,
      amtsl: d.amtsl,
      complications: Array.isArray(d.complications) ? d.complications.filter((c): c is string => typeof c === "string") : [],
      complicationsManaged: d.complicationsManaged,
      breastfeedingStart: d.breastfeedingStart as BreastfeedingStart | null,
      patient: d.pregnancy.patient,
    })),
    pregnancyEnds: pregnancyEnds.map((p) => ({ patientId: p.patientId, endedAt: p.endedAt!, abortionCare: p.abortionCare, patient: p.patient })),
    maternalDeaths: maternalDeaths
      .filter((p) => p.maternalDeathAt)
      .map((p) => ({ patientId: p.patientId, at: p.maternalDeathAt!, cause: p.maternalDeathCause, reviewedAt: p.maternalDeathReviewedAt, patient: p.patient })),
    postnatalVisits: postnatalVisits
      .filter((v) => v.pregnancy.delivery?.deliveryDate)
      .map((v) => ({
        patientId: v.pregnancy.patientId,
        visitDate: v.visitDate,
        deliveryDate: v.pregnancy.delivery!.deliveryDate!,
        vitaminAGiven: v.vitaminAGiven,
        ironFolateGiven: v.ironFolateGiven,
        breastfeedingCounseling: v.breastfeedingCounseling,
        newbornExamined: v.newbornExamined,
        newborns: v.pregnancy.delivery!.newborns
          .filter((n) => n.outcome !== "stillbirth" && (!n.diedAt || n.diedAt > v.visitDate))
          .map((n) => ({ id: n.id, sex: n.sex })),
        patient: v.pregnancy.patient,
      })),
    newborns: newborns
      .filter((n) => n.delivery.deliveryDate)
      .map((n) => {
        const deliveryDate = n.delivery.deliveryDate!;
        // The death of a live-born baby: on the birth record, at birth for a "neonatal death"
        // recorded without a date, or on its patient file.
        const diedAt =
          n.outcome === "stillbirth"
            ? null
            : (n.diedAt ?? (n.outcome === "neonatal_death" ? deliveryDate : null) ?? (n.patient?.isDeceased ? (n.patient.deceasedAt ?? null) : null));
        return {
          id: n.id,
          sex: n.sex,
          outcome: n.outcome,
          deliveryDate,
          lastMenstrualPeriod: n.delivery.pregnancy.lastMenstrualPeriod,
          birthWeightGrams: n.birthWeightGrams,
          apgarScore5Min: n.apgarScore5Min,
          bagMaskVentilation: n.bagMaskVentilation,
          kangarooCare: n.kangarooCare,
          incubatorCare: n.incubatorCare,
          stillbirthType: n.stillbirthType,
          breastfeedingStart: n.delivery.breastfeedingStart as BreastfeedingStart | null,
          diedAt,
          deathCause: n.deathCause,
          deathReviewedAt: n.deathReviewedAt,
        };
      }),
    fpVisits: fpVisits.map((v) => {
      const deliveriesBefore = v.patient.pregnancies
        .map((p) => p.delivery?.deliveryDate ?? null)
        .filter((d): d is Date => d !== null && d <= v.visitDate)
        .sort((a, b) => b.getTime() - a.getTime());
      return {
        id: v.id,
        patientId: v.patientId,
        visitDate: v.visitDate,
        clientStatus: v.clientStatus,
        counseled: v.counseled,
        methodCode: v.methodCode,
        isPostpartum: v.isPostpartum,
        referredByChw: v.referredByChw,
        lastDeliveryDate: deliveriesBefore[0] ?? null,
        patient: { birthDate: v.patient.birthDate, gender: v.patient.gender },
      };
    }),
  });
}
