import prisma from "@/lib/prisma";
import type { ActivityTable } from "@/lib/reports/activity-rows";
import { pregnancySelect, toPeriod } from "@/lib/reports/rma3-activity-data";
import { buildCodedTables, type Rma3Treatment } from "@/lib/reports/rma3-coded";
import { parseStoredLines, resolveLineArticle } from "@/lib/stock/prescription-items";
import { RMA3_TREATMENTS } from "@/lib/stock/input";

// Loads what the coded-diagnosis crossings and the act indicators need (rma3-coded.ts).

const DAY = 86_400_000;
const person = { select: { birthDate: true, gender: true } } as const;

export async function computeCodedTables(tenantId: string, start: Date, end: Date): Promise<ActivityTable[]> {
  const month = { gte: start, lt: end };

  const [diagnoses, treatedArticles, positiveMalariaTests, mappedActs] = await Promise.all([
    prisma.diagnosis.findMany({
      where: { tenantId, recordedAt: month },
      select: {
        patientId: true,
        stayId: true,
        context: true,
        icd10Code: true,
        isNewCase: true,
        isSuspected: true,
        recordedAt: true,
        stay: { select: { status: true } },
        patient: { select: { birthDate: true, gender: true, pregnancies: pregnancySelect } },
      },
    }),
    prisma.medicationInventory.findMany({ where: { tenantId, rma3Treatment: { not: null } }, select: { id: true, name: true, rma3Treatment: true } }),
    prisma.malariaCase.findMany({
      where: { tenantId, result: "positive", testType: { not: "clinical_only" }, diagnosedAt: { gte: new Date(start.getTime() - 30 * DAY), lt: end } },
      select: { patientId: true, diagnosedAt: true },
    }),
    prisma.medicalAct.findMany({ where: { tenantId, rma3Indicator: { not: null } }, select: { code: true, rma3Indicator: true } }),
  ]);

  // Treatments of the stays of the month's diagnoses: the tagged articles of their prescriptions.
  const stayIds = [...new Set(diagnoses.map((d) => d.stayId).filter((id): id is string => id !== null))];
  const stayTreatments: Record<string, Rma3Treatment[]> = {};
  if (treatedArticles.length && stayIds.length) {
    const byId = new Map(treatedArticles.map((a) => [a.id, a]));
    const byLowerName = new Map(treatedArticles.map((a) => [a.name.toLowerCase(), a]));
    const prescriptions = await prisma.prescription.findMany({ where: { tenantId, stayId: { in: stayIds } }, select: { stayId: true, items: true } });
    for (const p of prescriptions) {
      for (const line of parseStoredLines(p.items)) {
        const tag = resolveLineArticle(line, byId, byLowerName)?.rma3Treatment;
        if (tag && (RMA3_TREATMENTS as readonly string[]).includes(tag)) {
          const list = (stayTreatments[p.stayId!] ??= []);
          if (!list.includes(tag as Rma3Treatment)) list.push(tag as Rma3Treatment);
        }
      }
    }
  }

  // Acts linked to an RMA3 indicator: chosen at admission, or completed surgical procedures.
  const indicatorOf = new Map(mappedActs.map((a) => [a.code, a.rma3Indicator!]));
  const actCodes = [...indicatorOf.keys()];
  const [stayActs, procedures] = actCodes.length
    ? await Promise.all([
        prisma.stay.findMany({
          where: { tenantId, admissionDate: month, medicalActCode: { in: actCodes } },
          select: { id: true, patientId: true, admissionDate: true, medicalActCode: true, patient: person },
        }),
        prisma.surgicalProcedure.findMany({
          where: { tenantId, status: "completed", endedAt: month, procedureCode: { in: actCodes } },
          select: { id: true, patientId: true, endedAt: true, procedureCode: true, patient: person },
        }),
      ])
    : [[], []];

  return buildCodedTables({
    start,
    end,
    diagnoses: diagnoses.map((d) => ({
      patientId: d.patientId,
      stayId: d.stayId,
      context: d.context,
      icd10Code: d.icd10Code,
      isNewCase: d.isNewCase,
      isSuspected: d.isSuspected,
      recordedAt: d.recordedAt,
      stayTransferred: d.stay?.status === "transferred",
      patient: { birthDate: d.patient.birthDate, gender: d.patient.gender },
      pregnancies: d.patient.pregnancies.map(toPeriod),
    })),
    stayTreatments,
    positiveMalariaTests: positiveMalariaTests.map((t) => ({ patientId: t.patientId, at: t.diagnosedAt })),
    acts: [
      ...stayActs.map((s) => ({ id: s.id, patientId: s.patientId, at: s.admissionDate, indicator: indicatorOf.get(s.medicalActCode!)!, patient: s.patient })),
      ...procedures.map((p) => ({ id: p.id, patientId: p.patientId, at: p.endedAt!, indicator: indicatorOf.get(p.procedureCode!)!, patient: p.patient })),
    ],
  });
}
