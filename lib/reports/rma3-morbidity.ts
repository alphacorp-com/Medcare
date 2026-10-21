import type { DiagnosisContext, Gender } from "@prisma/client";
import prisma from "@/lib/prisma";
import { parseIcd10Ranges, codeMatchesItems, type Icd10Item } from "@/lib/diagnoses/icd10-ranges";
import { ageInCompletedMonths } from "@/lib/reports/age-bands";
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

type Band = { key: string; label: string; maxYears: number };

const SEXES = [
  { key: "M", label: "M" },
  { key: "F", label: "F" },
] as const;

// Upper bounds are inclusive, in completed years at the date of the consultation.
const UNDER5: Band[] = [
  { key: "lt5", label: "< 5 ans", maxYears: 4 },
  { key: "5plus", label: "5 ans et +", maxYears: Infinity },
];
const MENTAL: Band[] = [
  { key: "0-10", label: "0-10 ans", maxYears: 10 },
  { key: "11-20", label: "11-20 ans", maxYears: 20 },
  { key: "21-55", label: "21-55 ans", maxYears: 55 },
  { key: "56plus", label: "> 55 ans", maxYears: Infinity },
];
const EYE: Band[] = [
  { key: "0-14", label: "0-14 ans", maxYears: 14 },
  { key: "15-49", label: "15-49 ans", maxYears: 49 },
  { key: "50plus", label: "50 ans et +", maxYears: Infinity },
];

const BREAKDOWNS: Record<Rma3Breakdown, { bands: Band[] | null; bySex: boolean }> = {
  none: { bands: null, bySex: false },
  sex: { bands: null, bySex: true },
  under5: { bands: null, bySex: false }, // only children under 5 are counted at all
  under5Sex: { bands: UNDER5, bySex: true },
  mentalAgeSex: { bands: MENTAL, bySex: true },
  eyeAge: { bands: EYE, bySex: false },
  eyeAgeSex: { bands: EYE, bySex: true },
};

export function breakdownColumns(breakdown: Rma3Breakdown): Rma3MorbidityColumn[] {
  const { bands, bySex } = BREAKDOWNS[breakdown];
  if (bands && bySex) return bands.flatMap((b) => SEXES.map((s) => ({ key: `${b.key}_${s.key}`, label: `${b.label} ${s.label}` })));
  if (bands) return bands.map((b) => ({ key: b.key, label: b.label }));
  if (bySex) return SEXES.map((s) => ({ key: s.key, label: s.label }));
  return [];
}

// The column a new case falls in: a key, "" (counted in the total only: sex not recorded,
// or no breakdown), or null when the section does not count this patient at all.
export function columnFor(breakdown: Rma3Breakdown, birthDate: Date, gender: Gender, at: Date): string | null {
  const years = Math.floor(ageInCompletedMonths(birthDate, at) / 12);
  if (breakdown === "under5") return years < 5 ? "" : null;
  const { bands, bySex } = BREAKDOWNS[breakdown];
  const band = bands?.find((b) => years <= b.maxYears);
  const sex = gender === "M" || gender === "F" ? gender : null;
  if (bySex && !sex) return "";
  if (band && sex && bySex) return `${band.key}_${sex}`;
  if (band) return band.key;
  return bySex && sex ? sex : "";
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
      cells: Object.fromEntries(columns.map((c) => [c.key, 0])),
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
