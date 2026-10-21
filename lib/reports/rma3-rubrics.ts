import type { DiagnosisContext } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findRubricForCode } from "@/lib/diagnoses/icd10-ranges";
import { causeAgeBand } from "@/lib/reports/age-bands";
import { DEFAULT_RMA3_RUBRICS, type Rma3CauseSection } from "@/lib/reports/rma3-rubrics-default";

// Tenant's editable RMA3 cause rubrics (Settings) and the V.3 / V.4 / V.5 tables built
// from coded diagnoses.

// Inserts the default rubrics this tenant doesn't have yet. Never overwrites a rubric the
// administrator edited (skipDuplicates on the (tenantId, code) unique key).
export async function ensureDefaultRubrics(tenantId: string): Promise<void> {
  await prisma.rma3DiagnosisRubric.createMany({
    data: DEFAULT_RMA3_RUBRICS.map((r) => ({ tenantId, ...r })),
    skipDuplicates: true,
  });
}

export async function loadRubrics(tenantId: string) {
  await ensureDefaultRubrics(tenantId);
  return prisma.rma3DiagnosisRubric.findMany({
    where: { tenantId },
    orderBy: [{ section: "asc" }, { order: "asc" }],
  });
}

export interface Rma3CauseRow {
  code: string;
  label: string;
  age0to59m: number;
  age5to14: number;
  age15plus: number;
  total: number;
}

export interface Rma3CauseTable {
  section: Rma3CauseSection;
  rows: Rma3CauseRow[];
  // Principal diagnoses of the period that no active rubric claims (e.g. symptoms R00-R99):
  // shown so the table's total can be reconciled with the activity.
  unclassified: Rma3CauseRow;
}

const SECTION_CONTEXT: Record<Rma3CauseSection, DiagnosisContext> = {
  "V.3": "consultation", // principal diagnosis of each signed consultation
  "V.4": "discharge", // principal discharge diagnosis of each hospitalized stay
  "V.5": "death", // coded cause of each death
};

const emptyRow = (code: string, label: string): Rma3CauseRow => ({ code, label, age0to59m: 0, age5to14: 0, age15plus: 0, total: 0 });

export interface CauseDiagnosis {
  context: DiagnosisContext;
  icd10Code: string;
  recordedAt: Date;
  patient: { birthDate: Date };
}

export interface CauseRubric {
  section: string;
  code: string;
  label: string;
  icd10Ranges: string;
  order: number;
  isActive: boolean;
}

// Pure: dispatches each principal diagnosis to its table (by context), rubric (first active
// match by order) and age group at the date of the event.
export function buildCauseTables(rubrics: readonly CauseRubric[], diagnoses: readonly CauseDiagnosis[]): Rma3CauseTable[] {
  return (Object.keys(SECTION_CONTEXT) as Rma3CauseSection[]).map((section) => {
    const sectionRubrics = rubrics.filter((r) => r.section === section);
    const rows = [...sectionRubrics].filter((r) => r.isActive).sort((a, b) => a.order - b.order).map((r) => emptyRow(r.code, r.label));
    const byCode = new Map(rows.map((row) => [row.code, row]));
    const unclassified = emptyRow(`${section}-NC`, "Non classés (aucune rubrique)");

    for (const d of diagnoses) {
      if (d.context !== SECTION_CONTEXT[section]) continue;
      const rubric = findRubricForCode(d.icd10Code, sectionRubrics);
      const row = (rubric && byCode.get(rubric.code)) || unclassified;
      row[causeAgeBand(d.patient.birthDate, d.recordedAt)] += 1;
      row.total += 1;
    }
    return { section, rows, unclassified };
  });
}

export async function computeCauseTables(tenantId: string, start: Date, end: Date): Promise<Rma3CauseTable[]> {
  const [rubrics, diagnoses] = await Promise.all([
    loadRubrics(tenantId),
    prisma.diagnosis.findMany({
      where: { tenantId, kind: "principal", recordedAt: { gte: start, lt: end } },
      select: { context: true, icd10Code: true, recordedAt: true, patient: { select: { birthDate: true } } },
    }),
  ]);
  return buildCauseTables(rubrics, diagnoses);
}
