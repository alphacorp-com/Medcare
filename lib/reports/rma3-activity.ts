import { RMA3_AGE_SCHEMES, ageBand, rma3Sex } from "@/lib/reports/age-bands";
import {
  DAY,
  HOUR,
  ageSexBreakdown,
  inRange,
  isPregnantAt,
  row,
  sexColumns,
  type ActivityRow,
  type ActivityTable,
  type Breakdown,
  type Person,
  type PregnancyPeriod,
} from "@/lib/reports/activity-rows";

export { isPregnantAt };
export type { ActivityRow, ActivityTable, Person, PregnancyPeriod };

// RMA3 tables computed from the clinical activity already recorded (antenatal care,
// deliveries, newborns, stays, surgery, malaria and TB registers, vital signs), with the
// form's age / sex breakdown. Pure, unit-tested in rma3-activity.test.ts. Counting
// conventions: lib/reports/activity-rows.ts.

// Days after the end of a pregnancy during which a death is still a maternal death (WHO).
const MATERNAL_DEATH_WINDOW_DAYS = 42;
// Days after a surgery during which a death is counted as peri-operative.
const PERIOPERATIVE_WINDOW_DAYS = 30;

// ── Breakdowns ──────────────────────────────────────────────────────────────

const PREGNANT_COLUMN = { key: "pregnant", label: "Femmes enceintes" };

// IV.2.4-5: < 5 ans / 5 ans et + by sex, pregnant women in their own column.
export function malariaBreakdown<E extends { person: Person; at: Date; pregnant: boolean }>(): Breakdown<E> {
  const base = ageSexBreakdown<E>(RMA3_AGE_SCHEMES.under5, true);
  return { columns: [...base.columns, PREGNANT_COLUMN], keyOf: (e) => (e.pregnant ? PREGNANT_COLUMN.key : base.keyOf(e)) };
}

export type TbClassification = "pulmonary_bacteriologically_confirmed" | "pulmonary_clinically_diagnosed" | "extrapulmonary";
const TB_FORMS: [TbClassification, string][] = [
  ["pulmonary_bacteriologically_confirmed", "TPB+"],
  ["pulmonary_clinically_diagnosed", "TPB-"],
  ["extrapulmonary", "EP"],
];

// IV.3: 0-4 / 5-14 / 15 ans et + × TPB+ / TPB- / extra-pulmonaire.
export function tbBreakdown<E extends { person: Person; at: Date; classification: TbClassification }>(): Breakdown<E> {
  const bands = RMA3_AGE_SCHEMES.tuberculosis;
  return {
    columns: bands.flatMap((b) => TB_FORMS.map(([form, label]) => ({ key: `${b.key}_${form}`, label: `${b.label} ${label}` }))),
    keyOf: (e) => `${ageBand(bands, e.person.birthDate, e.at)}_${e.classification}`,
  };
}

// IV.2.1: rank of the antenatal contact / of the IPT dose (1, 2, 3, 4 and more).
const RANK_COLUMNS = [
  { key: "rank1", label: "1er" },
  { key: "rank2", label: "2e" },
  { key: "rank3", label: "3e" },
  { key: "rank4plus", label: "4e et +" },
];
const rankKey = (rank: number) => (rank >= 4 ? "rank4plus" : `rank${Math.max(1, rank)}`);

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface AntenatalVisitRow {
  pregnancyId: string;
  patientId: string;
  visitNumber: number;
  visitDate: Date;
  gestationalAgeWeeks: number;
  bloodPressureMeasured: boolean;
  ironFolateGiven: boolean;
  malariaPreventionGiven: boolean;
  patient: Person;
}

export interface DeliveryRow {
  patientId: string;
  deliveryDate: Date;
  mode: string | null;
  complications: string[];
  maternalOutcome: string | null;
  // Discharge of the delivery stay (null: no stay, or not discharged yet).
  stayDischargeDate: Date | null;
  hasStay: boolean;
  patient: Person;
}

export interface NewbornRow {
  id: string;
  sex: string;
  outcome: string;
  deliveryDate: Date;
}

export interface DeceasedWomanRow {
  patientId: string;
  deceasedAt: Date;
  patient: Person;
  pregnancies: PregnancyPeriod[];
}

export interface StayRow {
  id: string;
  patientId: string;
  admissionDate: Date;
  consultationStatus: string;
  hospitalizedAt: Date | null;
  dischargeDate: Date | null;
  status: string;
  patient: Person;
  pregnancies: PregnancyPeriod[];
}

export interface DeathRow {
  id: string;
  patientId: string;
  diedAt: Date;
  patient: Person;
  pregnancies: PregnancyPeriod[];
}

export interface SurgeryRow {
  id: string;
  patientId: string;
  endedAt: Date;
  patient: Person;
  // An intervention started then interrupted (status cancelled): not an "intervention
  // carried out" (V.1-007), but a death that follows it is peri-operative (V.1-008).
  interrupted?: boolean;
}

export interface MalariaCaseRow {
  id: string;
  patientId: string;
  diagnosedAt: Date;
  testType: string;
  result: string;
  severity: string | null;
  isPregnantAtDiagnosis: boolean;
  patient: Person;
}

export interface TbCaseRow {
  id: string;
  patientId: string;
  notificationDate: Date;
  caseType: string;
  classification: TbClassification;
  hivStatus: string;
  treatmentStartDate: Date | null;
  // Dates of the follow-ups with a sputum sample sent to the lab.
  labFollowUpDates: Date[];
  patient: Person;
}

export interface BloodPressureRow {
  patientId: string;
  recordedAt: Date;
  patient: Person;
}

export interface Rma3ActivityInput {
  start: Date;
  end: Date;
  // The report is built at `asOf` (min(end, now)): a stay still open is counted up to it.
  asOf: Date;
  antenatalVisits: AntenatalVisitRow[]; // every visit, up to `end`, of the pregnancies seen this month
  deliveries: DeliveryRow[]; // deliveries of the month
  newborns: NewbornRow[]; // born this month
  deceasedWomen: DeceasedWomanRow[]; // women who died this month, with their pregnancies
  // Maternal deaths recorded on the pregnancy (Pregnancy.maternalDeathAt), this month.
  recordedMaternalDeaths?: { patientId: string; at: Date; patient: Person }[];
  stays: StayRow[]; // admitted, hospitalized, discharged or open during the month
  deaths: DeathRow[]; // deaths of the month (deceased stays + deaths outside a stay)
  surgeries: SurgeryRow[]; // completed or interrupted from PERIOPERATIVE_WINDOW_DAYS before the month
  malariaCases: MalariaCaseRow[]; // diagnosed this month
  tbCases: TbCaseRow[]; // notified, started on treatment or followed up this month
  tbHivOnArtPatientIds: ReadonlySet<string>; // IV.3-013, from the HIV report
  bloodPressures: BloodPressureRow[]; // vital signs with a blood pressure, this month
}

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildActivityTables(input: Rma3ActivityInput): ActivityTable[] {
  const { start, end } = input;
  const inMonth = inRange(start, end);

  // ── II.1.1 antenatal care ──
  const mother = ageSexBreakdown<{ id: string; at: Date; person: Person }>(RMA3_AGE_SCHEMES.mother, false);
  const visitEv = (v: AntenatalVisitRow) => ({ id: v.patientId, at: v.visitDate, person: v.patient });
  const monthVisits = input.antenatalVisits.filter((v) => inMonth(v.visitDate));
  const byNumber = (n: number) => monthVisits.filter((v) => v.visitNumber === n).map(visitEv);
  const under15 = (v: AntenatalVisitRow) => ageBand(RMA3_AGE_SCHEMES.ptme, v.patient.birthDate, v.visitDate) === "under15";

  const byPregnancy = new Map<string, AntenatalVisitRow[]>();
  for (const v of [...input.antenatalVisits].sort((a, b) => a.visitDate.getTime() - b.visitDate.getTime())) {
    byPregnancy.set(v.pregnancyId, [...(byPregnancy.get(v.pregnancyId) ?? []), v]);
  }
  // The visit of the n-th iron / IPT dose of each pregnancy.
  const nthDoses = (given: (v: AntenatalVisitRow) => boolean) =>
    [...byPregnancy.values()].flatMap((visits) => visits.filter(given).map((visit, i) => ({ visit, rank: i + 1 })));
  const ironDoses = nthDoses((v) => v.ironFolateGiven);
  const iptDoses = nthDoses((v) => v.malariaPreventionGiven);

  const antenatal: ActivityTable = {
    section: "II.1.1",
    title: "Consultations prénatales",
    columns: mother.columns,
    rows: [
      row("II.1.1-001", "Femmes enceintes de moins de 15 ans reçues", mother, monthVisits.filter(under15).map(visitEv), true),
      row("II.1.1-002", "Total femmes enceintes reçues en CPN", mother, monthVisits.map(visitEv), true),
      row("II.1.1-003", "Femmes enceintes enregistrées en CPN1 (1er contact)", mother, byNumber(1), true),
      row("II.1.1-004", "Femmes enceintes CPN1 avant 16 semaines", mother, monthVisits.filter((v) => v.visitNumber === 1 && v.gestationalAgeWeeks < 16).map(visitEv), true),
      row("II.1.1-006", "Femmes enceintes enregistrées en CPN2", mother, byNumber(2), true),
      row("II.1.1-007", "Femmes enceintes enregistrées en CPN3", mother, byNumber(3), true),
      row("II.1.1-008", "Femmes enceintes reçues en CPN4", mother, byNumber(4), true),
      row("II.1.1-009", "Femmes enceintes reçues en CPN5+", mother, monthVisits.filter((v) => v.visitNumber >= 5).map(visitEv), true),
      row("II.1.1-015", "Femmes en CPN avec tension artérielle mesurée", mother, monthVisits.filter((v) => v.bloodPressureMeasured).map(visitEv), true),
      row(
        "II.1.1-024",
        "Femmes enceintes ayant reçu la 3e dose de fer / acide folique",
        mother,
        ironDoses.filter((d) => d.rank === 3 && inMonth(d.visit.visitDate)).map((d) => visitEv(d.visit)),
        true
      ),
    ],
    note: "Rang de CPN = numéro de visite saisi. 3e dose de fer / acide folique = 3e visite de la grossesse où il a été donné, comptée le mois de cette visite.",
  };

  // ── II.1.2 deliveries, II.1.3 post-natal ──
  const deliveryEv = (d: DeliveryRow) => ({ id: `${d.patientId}:${d.deliveryDate.getTime()}`, at: d.deliveryDate, person: d.patient });
  const monthDeliveries = input.deliveries.filter((d) => inMonth(d.deliveryDate));
  const complicated = (d: DeliveryRow) => d.complications.some((c) => c !== "none");

  const maternalDeaths = [
    ...monthDeliveries.filter((d) => d.maternalOutcome === "deceased").map((d) => ({ id: d.patientId, at: d.deliveryDate, person: d.patient })),
    ...input.deceasedWomen
      .filter((w) => inMonth(w.deceasedAt))
      .filter((w) => w.pregnancies.some((p) => p.lastMenstrualPeriod <= w.deceasedAt && w.deceasedAt.getTime() < p.endedAt.getTime() + MATERNAL_DEATH_WINDOW_DAYS * DAY))
      .map((w) => ({ id: w.patientId, at: w.deceasedAt, person: w.patient })),
    ...(input.recordedMaternalDeaths ?? []).filter((d) => inMonth(d.at)).map((d) => ({ id: d.patientId, at: d.at, person: d.patient })),
  ];

  // At least 48 h in the facility after the delivery (up to the discharge, or `asOf` when the
  // stay is still open).
  const stayed48h = (d: DeliveryRow) => d.hasStay && (d.stayDischargeDate ?? input.asOf).getTime() - d.deliveryDate.getTime() >= 48 * HOUR;

  const deliveries: ActivityTable = {
    section: "II.1.2",
    title: "Accouchements / SONU et consultations post-natales",
    columns: mother.columns,
    rows: [
      row("II.1.2-001", "Total accouchements effectués dans la formation sanitaire", mother, monthDeliveries.map(deliveryEv), false),
      row("II.1.2-004", "Accouchements suivis de complications obstétricales (total)", mother, monthDeliveries.filter(complicated).map(deliveryEv), false),
      row("II.1.2-005", "dont hémorragies", mother, monthDeliveries.filter((d) => d.complications.includes("postpartum_hemorrhage")).map(deliveryEv), false),
      row("II.1.2-006", "dont travail prolongé / dystocie", mother, monthDeliveries.filter((d) => d.complications.includes("obstructed_labour")).map(deliveryEv), false),
      row("II.1.2-010", "Césariennes réalisées", mother, monthDeliveries.filter((d) => d.mode === "cesarean").map(deliveryEv), false),
      row("II.1.2-015", "Décès maternels enregistrés (formation sanitaire)", mother, maternalDeaths, true),
      row("II.1.3-001", "Femmes ayant accouché et passé au moins 48 h en FOSA", mother, monthDeliveries.filter(stayed48h).map(deliveryEv), false),
    ],
    note:
      "Décès maternel = issue maternelle « décédée » à l'accouchement, décès maternel saisi sur la grossesse, ou décès d'une femme enceinte ou dans les 42 jours suivant la fin de sa grossesse. " +
      "48 h en FOSA : du moment de l'accouchement à la sortie du séjour (ou à la date du rapport si elle est encore hospitalisée).",
  };

  // ── II.1.4 newborns ──
  const sexBreakdown: Breakdown<{ id: string; at: Date; sex: string }> = { columns: sexColumns, keyOf: (e) => rma3Sex(e.sex) ?? "" };
  const monthNewborns = input.newborns.filter((n) => inMonth(n.deliveryDate)).map((n) => ({ id: n.id, at: n.deliveryDate, sex: n.sex, outcome: n.outcome }));
  const newborns: ActivityTable = {
    section: "II.1.4",
    title: "Naissances",
    columns: sexColumns,
    rows: [
      // A neonatal death was born alive.
      row("II.1.4-001", "Naissances vivantes enregistrées (formation sanitaire)", sexBreakdown, monthNewborns.filter((n) => n.outcome !== "stillbirth"), false),
      row("II.1.4-013", "Mort-nés enregistrés (total)", sexBreakdown, monthNewborns.filter((n) => n.outcome === "stillbirth"), false),
    ],
  };

  // ── IV.2.1 antenatal contacts and IPT ──
  const rankBreakdown = (rankOf: (e: { rank: number }) => number): Breakdown<{ id: string; at: Date; rank: number }> => ({
    columns: RANK_COLUMNS,
    keyOf: (e) => rankKey(rankOf(e)),
  });
  const ipt: ActivityTable = {
    section: "IV.2.1",
    title: "Traitement préventif intermittent (TPI) des femmes enceintes",
    columns: RANK_COLUMNS,
    rows: [
      row("IV.2.1-001", "Femmes enceintes vues en CPN (rang du contact)", rankBreakdown((e) => e.rank), monthVisits.map((v) => ({ id: `${v.pregnancyId}:${v.visitNumber}:${v.visitDate.getTime()}`, at: v.visitDate, rank: v.visitNumber })), false),
      row(
        "IV.2.1-002",
        "Femmes enceintes ayant reçu le TPI en CPN (TPI1 à TPI4+)",
        rankBreakdown((e) => e.rank),
        iptDoses.filter((d) => inMonth(d.visit.visitDate)).map((d) => ({ id: `${d.visit.pregnancyId}:${d.rank}`, at: d.visit.visitDate, rank: d.rank })),
        false
      ),
    ],
    note: "Rang du TPI = nombre de visites de la grossesse où le TPI a été donné, jusqu'à celle-ci.",
  };

  // ── IV.2.4-5 malaria morbidity / mortality ──
  type MalariaEv = { id: string; at: Date; person: Person; pregnant: boolean };
  const malariaCols = malariaBreakdown<MalariaEv>();
  const caseEv = (c: MalariaCaseRow): MalariaEv => ({ id: c.id, at: c.diagnosedAt, person: c.patient, pregnant: c.isPregnantAtDiagnosis });
  const cases = input.malariaCases.filter((c) => inMonth(c.diagnosedAt));
  const simple = cases.filter((c) => c.severity !== "severe");
  const positive = (c: MalariaCaseRow) => c.result === "positive" && c.testType !== "clinical_only";

  const consulted = input.stays.filter((s) => inMonth(s.admissionDate) && (s.consultationStatus === "claimed" || s.consultationStatus === "completed"));
  const hospitalized = input.stays.filter((s) => inMonth(s.hospitalizedAt));
  const deaths = input.deaths.filter((d) => inMonth(d.diedAt));
  const stayEv = (s: StayRow, at: Date): MalariaEv & { weight?: number } => ({ id: s.id, at, person: s.patient, pregnant: isPregnantAt(s.pregnancies, at) });
  const deathEv = (d: DeathRow): MalariaEv => ({ id: d.id, at: d.diedAt, person: d.patient, pregnant: isPregnantAt(d.pregnancies, d.diedAt) });

  const malaria: ActivityTable = {
    section: "IV.2.4-5",
    title: "Morbidité et mortalité (paludisme et toutes causes)",
    columns: malariaCols.columns,
    rows: [
      row("IV.2.4-5-001", "Consultations pour maladie (toutes causes)", malariaCols, consulted.map((s) => stayEv(s, s.admissionDate)), false),
      row("IV.2.4-5-002", "Cas suspects de paludisme (simple / grave)", malariaCols, cases.map(caseEv), false),
      row("IV.2.4-5-003", "Cas suspects testés", malariaCols, cases.filter((c) => c.testType !== "clinical_only").map(caseEv), false),
      row("IV.2.4-5-021", "Cas suspects simples (clinique)", malariaCols, simple.map(caseEv), false),
      row("IV.2.4-5-004", "Cas suspects simples avec test positif", malariaCols, simple.filter(positive).map(caseEv), false),
      row("IV.2.4-5-035", "Suspects simples TDR+", malariaCols, simple.filter((c) => c.testType === "rdt" && c.result === "positive").map(caseEv), false),
      row("IV.2.4-5-036", "Suspects simples microscopie+", malariaCols, simple.filter((c) => c.testType === "microscopy" && c.result === "positive").map(caseEv), false),
      row("IV.2.4-5-006", "Hospitalisations toutes causes", malariaCols, hospitalized.map((s) => stayEv(s, s.hospitalizedAt!)), false),
      row("IV.2.4-5-019", "Décès toutes causes", malariaCols, deaths.map(deathEv), false),
    ],
    note: "Consultation = séjour du mois pris en charge par un médecin (consultation en cours ou terminée). Femme enceinte = grossesse en cours à la date de l'événement.",
  };

  // ── IV.3 tuberculosis ──
  type TbEv = { id: string; at: Date; person: Person; classification: TbClassification };
  const tbCols = tbBreakdown<TbEv>();
  const notified = input.tbCases.filter((c) => inMonth(c.notificationDate));
  const tbEv = (c: TbCaseRow, at: Date = c.notificationDate): TbEv => ({ id: c.id, at, person: c.patient, classification: c.classification });
  const ofType = (...types: string[]) => notified.filter((c) => types.includes(c.caseType)).map((c) => tbEv(c));

  const tuberculosis: ActivityTable = {
    section: "IV.3",
    title: "Tuberculose : nouveaux cas, statut VIH et suivi",
    columns: tbCols.columns,
    rows: [
      row("IV.3-006", "Nouveaux cas", tbCols, ofType("new_case"), false),
      row("IV.3-007", "Rechutes", tbCols, ofType("relapse"), false),
      row("IV.3-008", "Reprises de traitement (après perte de vue)", tbCols, ofType("treatment_after_loss_to_follow_up"), false),
      row("IV.3-009", "Échecs (traitement après échec)", tbCols, ofType("treatment_after_failure"), false),
      row("IV.3-011", "Patients TB ayant fait le test VIH", tbCols, notified.filter((c) => c.hivStatus !== "unknown").map((c) => tbEv(c)), false),
      row("IV.3-012", "Patients TB positifs au VIH", tbCols, notified.filter((c) => c.hivStatus === "positive").map((c) => tbEv(c)), false),
      row("IV.3-013", "Patients TB VIH+ sous ARV", tbCols, notified.filter((c) => input.tbHivOnArtPatientIds.has(c.patientId)).map((c) => tbEv(c)), false),
      row("IV.3-016", "Patients TB mis sous traitement", tbCols, input.tbCases.filter((c) => inMonth(c.treatmentStartDate)).map((c) => tbEv(c, c.treatmentStartDate!)), false),
      row(
        "IV.3-017",
        "Patients TB envoyés au laboratoire pour le suivi",
        tbCols,
        input.tbCases.flatMap((c) => {
          const first = c.labFollowUpDates.filter(inMonth).sort((a, b) => a.getTime() - b.getTime())[0];
          return first ? [tbEv(c, first)] : [];
        }),
        false
      ),
    ],
    note: "Statut VIH testé = renseigné positif ou négatif dans le registre TB. Sous ARV = dans la file active TARV du mois. Suivi au laboratoire = au moins un contrôle d'expectoration fait dans le mois.",
  };

  // ── IV.4.4 hypertension screening ──
  const htaCols = ageSexBreakdown<{ id: string; at: Date; person: Person }>(RMA3_AGE_SCHEMES.hypertension, true);
  const hypertension: ActivityTable = {
    section: "IV.4.4",
    title: "Hypertension artérielle : dépistage",
    columns: htaCols.columns,
    rows: [
      row("IV.4.4-001", "Personnes dépistées (tension artérielle mesurée)", htaCols, input.bloodPressures.filter((b) => inMonth(b.recordedAt)).map((b) => ({ id: b.patientId, at: b.recordedAt, person: b.patient })), true),
    ],
    note: "Personnes dont la tension artérielle a été prise (constantes) dans le mois, comptées une fois.",
  };

  // ── V.1 general activity ──
  const causeCols = ageSexBreakdown<{ id: string; at: Date; person: Person; weight?: number }>(RMA3_AGE_SCHEMES.cause, false);
  const simpleStayEv = (s: StayRow, at: Date) => ({ id: s.id, at, person: s.patient });
  // Days of hospitalization that fall in the month (an open stay counts up to `asOf`).
  const hospitalDays = input.stays.flatMap((s) => {
    if (!s.hospitalizedAt) return [];
    const from = Math.max(s.hospitalizedAt.getTime(), start.getTime());
    const to = Math.min((s.dischargeDate ?? input.asOf).getTime(), end.getTime());
    const days = Math.round((to - from) / DAY);
    return days > 0 ? [{ id: s.id, at: new Date(from), person: s.patient, weight: days }] : [];
  });
  const surgeries = input.surgeries.filter((s) => !s.interrupted && inMonth(s.endedAt));
  const perioperativeDeaths = deaths.filter((d) =>
    input.surgeries.some((s) => s.patientId === d.patientId && s.endedAt <= d.diedAt && d.diedAt.getTime() - s.endedAt.getTime() <= PERIOPERATIVE_WINDOW_DAYS * DAY)
  );

  const general: ActivityTable = {
    section: "V.1",
    title: "Consultations, hospitalisations, références et décès",
    columns: causeCols.columns,
    rows: [
      row("V.1-001", "Total consultations du mois", causeCols, consulted.map((s) => simpleStayEv(s, s.admissionDate)), false),
      row("V.1-003", "Total personnes hospitalisées", causeCols, hospitalized.map((s) => ({ ...simpleStayEv(s, s.hospitalizedAt!), id: s.patientId })), true),
      row("V.1-004", "Total jours d'hospitalisation", causeCols, hospitalDays, false),
      row("V.1-006", "Patients référés à l'échelon supérieur", causeCols, input.stays.filter((s) => s.status === "transferred" && inMonth(s.dischargeDate)).map((s) => simpleStayEv(s, s.dischargeDate!)), false),
      row("V.1-007", "Interventions chirurgicales", causeCols, surgeries.map((s) => ({ id: s.id, at: s.endedAt, person: s.patient })), false),
      row("V.1-008", "Décès péri-opératoires", causeCols, perioperativeDeaths.map((d) => ({ id: d.id, at: d.diedAt, person: d.patient })), false),
      row("V.1-010", "Total décès enregistrés", causeCols, deaths.map((d) => ({ id: d.id, at: d.diedAt, person: d.patient })), false),
    ],
    note:
      "Jours d'hospitalisation = journées passées dans le mois (de l'hospitalisation à la sortie, ou à la date du rapport). " +
      "Référé = séjour sorti « transféré ». Décès péri-opératoire = décès dans les 30 jours suivant une intervention terminée.",
  };

  return [antenatal, deliveries, newborns, ipt, malaria, tuberculosis, hypertension, general];
}
