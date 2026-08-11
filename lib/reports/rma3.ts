import prisma from "@/lib/prisma";
import { computeMonthlyIndicators, periodToDateRange, Dhis2Period } from "@/lib/dhis2/indicators";
import { Dhis2MetricKey, Dhis2MetricValue } from "@/lib/dhis2/types";

export interface Rma3Identification {
  facilityName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  region: null;
  department: null;
  district: null;
  healthArea: null;
}

export interface Rma3KeyValueRow {
  label: string;
  value: number;
}

export interface Rma3VaccinationRow {
  antigenCode: string;
  antigenName: string;
  doseNumber: number;
  boys: number;
  girls: number;
  unknownSex: number;
  total: number;
  ageUnder12m: number;
  age12to23m: number;
  age24to59m: number;
  age5yPlus: number;
  outOfSchedule: number;
}

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
  malaria: Rma3MalariaRow[];
  tuberculosis: Rma3TbSection;
}

function pickMetrics(values: Dhis2MetricValue[]): Record<Dhis2MetricKey, number> {
  const map = {} as Record<Dhis2MetricKey, number>;
  for (const { metricKey, value } of values) {
    map[metricKey] = value;
  }
  return map;
}

async function computeIdentificationSection(tenantId: string): Promise<Rma3Identification> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, address: true, contactPhone: true, contactEmail: true },
  });
  return {
    facilityName: tenant?.name ?? "",
    address: tenant?.address ?? null,
    phone: tenant?.contactPhone ?? null,
    email: tenant?.contactEmail ?? null,
    region: null,
    department: null,
    district: null,
    healthArea: null,
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
    { label: "Naissances vivantes", value: metrics.newborns_total ?? 0 },
    { label: "Doses de VAT (vaccin antitétanique) données en CPN", value: metrics.tetanus_doses_given ?? 0 },
    { label: "Doses de TPI/prévention du paludisme données en CPN", value: metrics.malaria_prevention_doses_given ?? 0 },
    { label: "Dépistages VIH réalisés chez les femmes enceintes (PTME)", value: metrics.hiv_tests_pregnancy_completed ?? 0 },
  ];
}

async function computeVaccinationSection(tenantId: string, period: Dhis2Period): Promise<Rma3VaccinationRow[]> {
  const { start, end } = periodToDateRange(period);

  const [rows, catalog] = await Promise.all([
    prisma.immunization.findMany({
      where: { tenantId, administeredAt: { gte: start, lt: end } },
      select: {
        antigenCode: true,
        antigenName: true,
        doseNumber: true,
        ageInDaysAtAdministration: true,
        isOutOfSchedule: true,
        patient: { select: { gender: true } },
      },
    }),
    prisma.referenceCatalogItem.findMany({
      where: { catalogType: "vaccine_antigen", OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { order: "asc" },
      select: { code: true, order: true },
    }),
  ]);

  const order = new Map<string, number>();
  catalog.forEach((item, index) => {
    if (!order.has(item.code)) order.set(item.code, item.order * 1000 + index);
  });

  const grouped = new Map<string, Rma3VaccinationRow>();
  for (const row of rows) {
    const key = `${row.antigenCode}:${row.doseNumber}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        antigenCode: row.antigenCode,
        antigenName: row.antigenName,
        doseNumber: row.doseNumber,
        boys: 0,
        girls: 0,
        unknownSex: 0,
        total: 0,
        ageUnder12m: 0,
        age12to23m: 0,
        age24to59m: 0,
        age5yPlus: 0,
        outOfSchedule: 0,
      };
      grouped.set(key, entry);
    }

    if (row.patient.gender === "M") entry.boys += 1;
    else if (row.patient.gender === "F") entry.girls += 1;
    else entry.unknownSex += 1;
    entry.total += 1;

    const ageDays = row.ageInDaysAtAdministration;
    if (ageDays < 365) entry.ageUnder12m += 1;
    else if (ageDays < 730) entry.age12to23m += 1;
    else if (ageDays < 1826) entry.age24to59m += 1;
    else entry.age5yPlus += 1;

    if (row.isOutOfSchedule) entry.outOfSchedule += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const orderA = order.get(a.antigenCode) ?? Number.MAX_SAFE_INTEGER;
    const orderB = order.get(b.antigenCode) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.antigenCode.localeCompare(b.antigenCode) || a.doseNumber - b.doseNumber;
  });
}

const MALARIA_AGE_5_YEARS_DAYS = 1826;

function malariaBucket(c: { isPregnantAtDiagnosis: boolean; ageInDaysAtDiagnosis: number }): "under5" | "over5" | "pregnant" {
  if (c.isPregnantAtDiagnosis) return "pregnant";
  return c.ageInDaysAtDiagnosis < MALARIA_AGE_5_YEARS_DAYS ? "under5" : "over5";
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
      ageInDaysAtDiagnosis: true,
      treatedWithAct: true,
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

function tbAgeBracket(birthDate: Date, asOf: Date): "age0to4" | "age5to14" | "age15Plus" {
  const ageYears = (asOf.getTime() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (ageYears < 5) return "age0to4";
  if (ageYears < 15) return "age5to14";
  return "age15Plus";
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
  const [rawMetrics, identification, vaccination, malaria, tuberculosis, bedCount] = await Promise.all([
    computeMonthlyIndicators(tenantId, period),
    computeIdentificationSection(tenantId),
    computeVaccinationSection(tenantId, period),
    computeMalariaSection(tenantId, period),
    computeTuberculosisSection(tenantId, period),
    prisma.bed.count({ where: { tenantId, isActive: true } }),
  ]);

  const metrics = pickMetrics(rawMetrics);

  return {
    period,
    identification,
    facilityActivity: buildFacilityActivityRows(metrics, bedCount),
    maternalHealth: buildMaternalHealthRows(metrics),
    vaccination,
    malaria,
    tuberculosis,
  };
}
