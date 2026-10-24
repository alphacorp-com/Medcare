import prisma from "@/lib/prisma";
import { computeMonthlyIndicators, periodToDateRange, Dhis2Period } from "@/lib/dhis2/indicators";
import { Dhis2MetricKey, Dhis2MetricValue } from "@/lib/dhis2/types";
import { computeCauseTables, type Rma3CauseTable } from "@/lib/reports/rma3-rubrics";
import { computeMorbidityTables, type Rma3MorbidityTable } from "@/lib/reports/rma3-morbidity";
import { computeStockReport, type StockReportItemRow } from "@/lib/stock/report-data";
import { computeEpiSections, type Rma3EpiSections } from "@/lib/epi/rma3-epi-data";
import { computeHivReport } from "@/lib/hiv/rma3-hiv-data";
import { computeActivityTables } from "@/lib/reports/rma3-activity-data";
import { computeMotherChildTables } from "@/lib/reports/rma3-mother-child-data";
import { computeCodedTables } from "@/lib/reports/rma3-coded-data";
import { computeProgramTables } from "@/lib/reports/rma3-programs-data";
import { computeBillingIncome, computeComplementTables } from "@/lib/reports/rma3-complements-data";
import { buildIncomeTable } from "@/lib/reports/rma3-income";
import type { ActivityTable } from "@/lib/reports/rma3-activity";
import { loadIdentification, loadManualForm } from "@/lib/rma3-manual/data";
import { buildManualReport, type Rma3ManualReport } from "@/lib/rma3-manual/report";
import type { Rma3IdentificationSettings } from "@/lib/rma3-manual/input";
import type { Rma3HivReport } from "@/lib/hiv/rma3-hiv";
import type { Rma3VaccinationRow } from "@/lib/epi/rma3-epi";
import { RMA3_AGE_SCHEMES, ageBand, bandOrPregnant, rma3Sex } from "@/lib/reports/age-bands";

export type { Rma3CauseRow, Rma3CauseTable } from "@/lib/reports/rma3-rubrics";
export type { Rma3MorbidityRow, Rma3MorbidityTable } from "@/lib/reports/rma3-morbidity";
export type { ActivityTable, ActivityRow } from "@/lib/reports/rma3-activity";

// Facility contact details, plus the MINSANTE identification entered on the RMA3 form page.
export interface Rma3Identification extends Rma3IdentificationSettings {
  facilityName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface Rma3KeyValueRow {
  label: string;
  value: number;
}

export type { Rma3VaccinationRow, Rma3HpvRow, Rma3AefiRow, Rma3ColdChain, Rma3SessionCounts } from "@/lib/epi/rma3-epi";

export interface Rma3MalariaRow {
  label: string;
  under5: number;
  over5: number;
  pregnant: number;
  total: number;
}

export interface Rma3TbRow {
  label: string;
  age0to4: number;
  age5to14: number;
  age15Plus: number;
  total: number;
}

export interface Rma3TbSection {
  notifications: Rma3TbRow[];
  outcomes: Rma3TbRow[];
}

export interface Rma3ReportData {
  period: Dhis2Period;
  identification: Rma3Identification;
  facilityActivity: Rma3KeyValueRow[];
  maternalHealth: Rma3KeyValueRow[];
  vaccination: Rma3VaccinationRow[];
  // III.1 sessions, III.3 HPV, III.4 cold chain, III.6 AEFI.
  epi: Omit<Rma3EpiSections, "vaccination">;
  malaria: Rma3MalariaRow[];
  tuberculosis: Rma3TbSection;
  // V.3 / V.4 / V.5 — from coded diagnoses and the tenant's ICD-10 → RMA3 correspondence.
  causes: Rma3CauseTable[];
  // II.2, III.7, IV.4, IV.4.9-11, IV.5 — new cases from coded consultation diagnoses.
  morbidity: Rma3MorbidityTable[];
  // V.7 tracers, III.5 EPI inputs, IV.2.7 antimalarials, V.9 oxygen, IV.6 nutrition: the
  // monthly stock report of the articles given an RMA3 category.
  stock: StockReportItemRow[];
  // II.3 PMTCT, II.1.1 antenatal syphilis / hepatitis B, IV.1 HIV and hepatitis / STI.
  hiv: Rma3HivReport;
  // II.1.1-II.1.5, III.9, IV.2.1, IV.2.4-5, IV.3, IV.4.4, V.1 — the clinical activity with the
  // form's age / sex breakdown (rma3-activity.ts, rma3-mother-child.ts).
  activity: ActivityTable[];
  // Community activity, supervisions, environment, income outside billing, expenses: the
  // RMA3 monthly form (lib/rma3-manual).
  manual: Rma3ManualReport;
}

function pickMetrics(values: Dhis2MetricValue[]): Record<Dhis2MetricKey, number> {
  const map = {} as Record<Dhis2MetricKey, number>;
  for (const { metricKey, value } of values) {
    map[metricKey] = value;
  }
  return map;
}

async function computeIdentificationSection(tenantId: string): Promise<Rma3Identification> {
  const [tenant, minsante] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, address: true, contactPhone: true, contactEmail: true },
    }),
    loadIdentification(tenantId),
  ]);
  return {
    ...minsante,
    facilityName: tenant?.name ?? "",
    address: tenant?.address ?? null,
    phone: tenant?.contactPhone ?? null,
    email: tenant?.contactEmail ?? null,
  };
}

function buildFacilityActivityRows(metrics: Record<Dhis2MetricKey, number>, bedCount: number): Rma3KeyValueRow[] {
  return [
    { label: "Total admissions/hospitalisations", value: metrics.admissions_total ?? 0 },
    { label: "Admissions en urgence", value: metrics.admissions_emergency ?? 0 },
    { label: "Admissions programmées", value: metrics.admissions_scheduled ?? 0 },
    { label: "Consultations externes", value: metrics.admissions_outpatient ?? 0 },
    { label: "Sorties (déchargées)", value: metrics.discharges_total ?? 0 },
    { label: "Décès", value: metrics.deaths_total ?? 0 },
    { label: "Interventions chirurgicales", value: metrics.surgeries_completed ?? 0 },
    { label: "Examens de laboratoire réalisés", value: metrics.lab_exams_completed ?? 0 },
    { label: "Examens de radiologie réalisés", value: metrics.radiology_exams_completed ?? 0 },
    { label: "Nombre total de lits disponibles", value: bedCount },
  ];
}

function buildMaternalHealthRows(metrics: Record<Dhis2MetricKey, number>): Rma3KeyValueRow[] {
  return [
    { label: "CPN1 (première visite prénatale)", value: metrics.anc_first_visit ?? 0 },
    { label: "CPN4+ (4e visite prénatale et plus)", value: metrics.anc_fourth_visit_plus ?? 0 },
    { label: "Accouchements - total", value: metrics.deliveries_total ?? 0 },
    { label: "dont césariennes", value: metrics.deliveries_cesarean ?? 0 },
    { label: "Nouveau-nés enregistrés (vivants et mort-nés)", value: metrics.newborns_total ?? 0 },
    { label: "Doses de VAT (vaccin antitétanique) données en CPN", value: metrics.tetanus_doses_given ?? 0 },
    { label: "Doses de TPI/prévention du paludisme données en CPN", value: metrics.malaria_prevention_doses_given ?? 0 },
    { label: "Dépistages VIH réalisés chez les femmes enceintes (PTME)", value: metrics.hiv_tests_pregnancy_completed ?? 0 },
  ];
}

// "< 5 ans / 5 ans et + / Femmes enceintes": a pregnant woman is counted in her own column.
function malariaBucket(c: { isPregnantAtDiagnosis: boolean; diagnosedAt: Date; patient: { birthDate: Date } }) {
  return bandOrPregnant(ageBand(RMA3_AGE_SCHEMES.under5, c.patient.birthDate, c.diagnosedAt), c.isPregnantAtDiagnosis);
}

async function computeMalariaSection(tenantId: string, period: Dhis2Period): Promise<Rma3MalariaRow[]> {
  const { start, end } = periodToDateRange(period);
  const cases = await prisma.malariaCase.findMany({
    where: { tenantId, diagnosedAt: { gte: start, lt: end } },
    select: {
      testType: true,
      result: true,
      severity: true,
      isPregnantAtDiagnosis: true,
      diagnosedAt: true,
      treatedWithAct: true,
      patient: { select: { birthDate: true } },
    },
  });

  const rows: Rma3MalariaRow[] = [
    { label: "Cas suspects testés par TDR", under5: 0, over5: 0, pregnant: 0, total: 0 },
    { label: "Cas suspects testés par microscopie (Goutte Épaisse)", under5: 0, over5: 0, pregnant: 0, total: 0 },
    { label: "Cas confirmés positifs", under5: 0, over5: 0, pregnant: 0, total: 0 },
    { label: "Cas simples traités avec ACT", under5: 0, over5: 0, pregnant: 0, total: 0 },
    { label: "Cas graves/sévères", under5: 0, over5: 0, pregnant: 0, total: 0 },
  ];

  for (const c of cases) {
    const bucket = malariaBucket(c);
    if (!bucket) continue; // unreachable: the scheme is open-ended from birth
    if (c.testType === "rdt") rows[0][bucket] += 1;
    if (c.testType === "microscopy") rows[1][bucket] += 1;
    if (c.result === "positive") rows[2][bucket] += 1;
    if (c.treatedWithAct && c.severity !== "severe") rows[3][bucket] += 1;
    if (c.severity === "severe") rows[4][bucket] += 1;
  }

  for (const row of rows) {
    row.total = row.under5 + row.over5 + row.pregnant;
  }

  return rows;
}

// 0-4 / 5-14 / 15 ans et +, calendar age at the notification / outcome date.
function tbAgeBracket(birthDate: Date, asOf: Date) {
  return ageBand(RMA3_AGE_SCHEMES.tuberculosis, birthDate, asOf)!; // open-ended from birth: never null
}

const TB_CLASSIFICATION_LABELS: Record<string, string> = {
  pulmonary_bacteriologically_confirmed: "Pulmonaire, confirmée bactériologiquement (TPB+)",
  pulmonary_clinically_diagnosed: "Pulmonaire, diagnostiquée cliniquement (TPB-)",
  extrapulmonary: "Extrapulmonaire (TEP)",
};

const TB_OUTCOME_LABELS: Record<string, string> = {
  on_treatment: "En cours de traitement",
  cured: "Guéri",
  treatment_completed: "Traitement terminé",
  treatment_failed: "Échec thérapeutique",
  died: "Décédé",
  lost_to_follow_up: "Perdu de vue",
  not_evaluated: "Non évalué",
  transferred_out: "Transféré",
};

function emptyTbRow(label: string): Rma3TbRow {
  return { label, age0to4: 0, age5to14: 0, age15Plus: 0, total: 0 };
}

async function computeTuberculosisSection(tenantId: string, period: Dhis2Period): Promise<Rma3TbSection> {
  const { start, end } = periodToDateRange(period);

  const [notified, resolved] = await Promise.all([
    prisma.tbCase.findMany({
      where: { tenantId, notificationDate: { gte: start, lt: end } },
      select: { classification: true, notificationDate: true, patient: { select: { birthDate: true } } },
    }),
    prisma.tbCase.findMany({
      where: { tenantId, outcomeDate: { gte: start, lt: end } },
      select: { outcome: true, outcomeDate: true, patient: { select: { birthDate: true } } },
    }),
  ]);

  const notifications = Object.keys(TB_CLASSIFICATION_LABELS).map((key) => emptyTbRow(TB_CLASSIFICATION_LABELS[key]));
  const classificationIndex = Object.keys(TB_CLASSIFICATION_LABELS);
  for (const c of notified) {
    const idx = classificationIndex.indexOf(c.classification);
    if (idx === -1) continue;
    const bracket = tbAgeBracket(c.patient.birthDate, c.notificationDate);
    notifications[idx][bracket] += 1;
    notifications[idx].total += 1;
  }

  const outcomes = Object.keys(TB_OUTCOME_LABELS).map((key) => emptyTbRow(TB_OUTCOME_LABELS[key]));
  const outcomeIndex = Object.keys(TB_OUTCOME_LABELS);
  for (const r of resolved) {
    if (!r.outcomeDate) continue;
    const idx = outcomeIndex.indexOf(r.outcome);
    if (idx === -1) continue;
    const bracket = tbAgeBracket(r.patient.birthDate, r.outcomeDate);
    outcomes[idx][bracket] += 1;
    outcomes[idx].total += 1;
  }

  return { notifications, outcomes };
}

export async function computeRma3Report(tenantId: string, period: Dhis2Period): Promise<Rma3ReportData> {
  const { start, end } = periodToDateRange(period);
  const hivReport = computeHivReport(tenantId, start, end);
  // IV.3-013 needs the ART active file of the HIV report.
  const activityTables = hivReport.then((report) => computeActivityTables(tenantId, start, end, report.tbHivOnArtPatientIds));
  const [rawMetrics, identification, epiSections, malaria, tuberculosis, bedCount, causes, morbidity, stockReport, hiv, activity, motherChild, coded, programs, complements, income, manualForm] = await Promise.all([
    computeMonthlyIndicators(tenantId, period),
    computeIdentificationSection(tenantId),
    computeEpiSections(tenantId, start, end),
    computeMalariaSection(tenantId, period),
    computeTuberculosisSection(tenantId, period),
    prisma.bed.count({ where: { tenantId, isActive: true } }),
    computeCauseTables(tenantId, start, end),
    computeMorbidityTables(tenantId, start, end),
    computeStockReport(tenantId, period),
    hivReport,
    activityTables,
    computeMotherChildTables(tenantId, start, end),
    computeCodedTables(tenantId, start, end),
    computeProgramTables(tenantId, start, end),
    computeComplementTables(tenantId, start, end),
    computeBillingIncome(tenantId, start, end),
    loadManualForm(tenantId, period),
  ]);

  const metrics = pickMetrics(rawMetrics);
  const { vaccination, ...epi } = epiSections;

  return {
    period,
    identification,
    facilityActivity: buildFacilityActivityRows(metrics, bedCount),
    maternalHealth: buildMaternalHealthRows(metrics),
    vaccination,
    epi,
    malaria,
    tuberculosis,
    causes,
    morbidity,
    stock: (stockReport?.rows ?? []).filter((row) => row.rma3Category !== null),
    hiv,
    activity: [
      ...activity,
      ...motherChild,
      ...coded,
      ...programs,
      ...complements,
      // VI.3: billing income, sub-totals with the income rubrics of the monthly form.
      buildIncomeTable(income, Object.fromEntries(Object.entries(manualForm.values).map(([code, cells]) => [code, cells[""] ?? 0]))),
    ],
    manual: buildManualReport(manualForm.values, manualForm.status, manualForm.validatedAt),
  };
}
