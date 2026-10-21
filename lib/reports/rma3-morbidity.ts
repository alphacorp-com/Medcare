import type { DiagnosisContext, Gender } from "@prisma/client";
import prisma from "@/lib/prisma";
import { parseIcd10Ranges, codeMatchesItems, type Icd10Item } from "@/lib/diagnoses/icd10-ranges";
import { RMA3_AGE_SCHEMES, disaggregationColumns, disaggregationKey, emptyCells, type Disaggregation } from "@/lib/reports/age-bands";
import { loadRubrics, type CauseRubric } from "@/lib/reports/rma3-rubrics";
import {
  RMA3_MORBIDITY_SECTIONS,
  RMA3_NOT_DERIVABLE,
  type Rma3Breakdown,
  type Rma3MorbiditySection,
} from "@/lib/reports/rma3-morbidity-default";

// RMA3 morbidity tables (II.2, III.7, IV.4, IV.4.9-11, IV.5) built from coded diagnoses.
// See rma3-morbidity-default.ts for the counting rules.

export interface Rma3MorbidityColumn {
  key: string;
  label: string;
}

export interface Rma3MorbidityRow {
  code: string;
  label: string;
  cells: Record<string, number>;
  // Every new case of the row, including those outside the columns (sex not recorded).
  total: number;
  deaths: number | null;
}

export interface Rma3MorbidityTable {
  section: Rma3MorbiditySection;
  title: string;
  columns: Rma3MorbidityColumn[];
  rows: Rma3MorbidityRow[];
  notDerivable: string[];
}

export interface MorbidityDiagnosis {
  context: DiagnosisContext;
  icd10Code: string;
  isNewCase: boolean;
  recordedAt: Date;
  patient: { birthDate: Date; gender: Gender };
}

// Each section's RMA3 breakdown, from the shared age/sex schemes.
const BREAKDOWNS: Record<Rma3Breakdown, Disaggregation> = {
  none: { bands: null, bySex: false },
  sex: { bands: null, bySex: true },
  under5: { bands: RMA3_AGE_SCHEMES.child0to59m, bySex: false }, // older children are not counted at all
  under5Sex: { bands: RMA3_AGE_SCHEMES.under5, bySex: true },
  mentalAgeSex: { bands: RMA3_AGE_SCHEMES.mentalHealth, bySex: true },
  eyeAge: { bands: RMA3_AGE_SCHEMES.eyeOral, bySex: false },
  eyeAgeSex: { bands: RMA3_AGE_SCHEMES.eyeOral, bySex: true },
};

export function breakdownColumns(breakdown: Rma3Breakdown): Rma3MorbidityColumn[] {
  return disaggregationColumns(BREAKDOWNS[breakdown]);
}

// The column a new case falls in ("" = total only, null = not counted): see disaggregationKey.
export function columnFor(breakdown: Rma3Breakdown, birthDate: Date, gender: Gender, at: Date): string | null {
  return disaggregationKey(BREAKDOWNS[breakdown], { birthDate, gender }, at);
}

// Pure: counts new-case consultation diagnoses (principal or secondary) in every active
// rubric covering their code, and causes of death in the "deaths" column where relevant.
export function buildMorbidityTables(rubrics: readonly CauseRubric[], diagnoses: readonly MorbidityDiagnosis[]): Rma3MorbidityTable[] {
  return RMA3_MORBIDITY_SECTIONS.map(({ section, title, breakdown, countDeaths }) => {
    const active = rubrics
      .filter((r) => r.section === section && r.isActive)
      .sort((a, b) => a.order - b.order)
      .map((r) => {
        const parsed = parseIcd10Ranges(r.icd10Ranges);
        return { rubric: r, items: (parsed.ok ? parsed.items : []) as Icd10Item[] };
      });
    const columns = breakdownColumns(breakdown);
    const rows: Rma3MorbidityRow[] = active.map(({ rubric }) => ({
      code: rubric.code,
      label: rubric.label,
      cells: emptyCells(columns),
      total: 0,
      deaths: countDeaths ? 0 : null,
    }));

    for (const d of diagnoses) {
      const isNewCase = d.context === "consultation" && d.isNewCase;
      const isDeath = countDeaths && d.context === "death";
      if (!isNewCase && !isDeath) continue;
      const column = isNewCase ? columnFor(breakdown, d.patient.birthDate, d.patient.gender, d.recordedAt) : null;
      active.forEach(({ items }, index) => {
        if (!codeMatchesItems(d.icd10Code, items)) return;
        const row = rows[index];
        if (isDeath) row.deaths = (row.deaths ?? 0) + 1;
        if (isNewCase && column !== null) {
          row.total += 1;
          if (column) row.cells[column] += 1;
        }
      });
    }
    return { section, title, columns, rows, notDerivable: RMA3_NOT_DERIVABLE[section] };
  });
}

export async function computeMorbidityTables(tenantId: string, start: Date, end: Date): Promise<Rma3MorbidityTable[]> {
  const [rubrics, diagnoses] = await Promise.all([
    loadRubrics(tenantId),
    prisma.diagnosis.findMany({
      where: {
        tenantId,
        recordedAt: { gte: start, lt: end },
        OR: [{ context: "consultation", isNewCase: true }, { context: "death" }],
      },
      select: {
        context: true,
        icd10Code: true,
        isNewCase: true,
        recordedAt: true,
        patient: { select: { birthDate: true, gender: true } },
      },
    }),
  ]);
  return buildMorbidityTables(rubrics, diagnoses);
}
