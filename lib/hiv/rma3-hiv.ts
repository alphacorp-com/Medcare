import { PROVISIONAL_AGE_SCHEMES, RMA3_AGE_SCHEMES, ageInCompletedMonths, disaggregationColumns, disaggregationKey, emptyCells, type Disaggregation } from "@/lib/reports/age-bands";
import { ART_REGIMENS } from "@/lib/hiv/regimens";
import { STI_TEST_TYPES, isSuppressed, type EntryPoint, type ScreeningResult, type ScreeningTestType } from "@/lib/hiv/input";

// RMA3 HIV / PMTCT / hepatitis / STI tables from the program records. Pure, unit-tested in
// rma3-hiv.test.ts. Conventions:
//  - "personnes": each person counted once per indicator and month (first event);
//  - known HIV-positive = a positive HIV test or an ART enrolment before the event;
//  - ART follow-up at the end of the month: days late = month end − next appointment of
//    the last visit; 30-59 days = "non venu 1 mois", 60-89 = "2 mois", ≥ 90 = lost to
//    follow-up (PDV, out of the active file);
//  - ages at the date of the event; HIV (13) and hepatitis (9) bands are PROVISIONAL.

export type Rma3Scheme = "hiv13" | "hep9" | "ptme" | "mother" | "none";

const SCHEMES: Record<Rma3Scheme, Disaggregation> = {
  hiv13: { bands: PROVISIONAL_AGE_SCHEMES.hiv13, bySex: true },
  hep9: { bands: PROVISIONAL_AGE_SCHEMES.hep9, bySex: true },
  ptme: { bands: RMA3_AGE_SCHEMES.ptme, bySex: false },
  mother: { bands: RMA3_AGE_SCHEMES.mother, bySex: false },
  none: { bands: null, bySex: false },
};

export function schemeColumns(scheme: Rma3Scheme) {
  return disaggregationColumns(SCHEMES[scheme]);
}

export interface Person {
  birthDate: Date;
  gender: string | null;
}

export interface IndicatorRow {
  code: string;
  label: string;
  scheme: Rma3Scheme;
  cells: Record<string, number>;
  total: number;
}

interface Counted {
  patientId: string;
  person: Person;
  at: Date;
}

// One row; each person counted once (first event), in the column of their age at the event.
function indicator(code: string, label: string, scheme: Rma3Scheme, events: readonly Counted[]): IndicatorRow {
  const config = SCHEMES[scheme];
  const cells = emptyCells(disaggregationColumns(config));
  const seen = new Set<string>();
  let total = 0;
  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (seen.has(e.patientId)) continue;
    seen.add(e.patientId);
    const key = disaggregationKey(config, e.person, e.at);
    if (key === null) {
      // Outside the scheme's bands (e.g. a 9-year-old in the "mother" bands): total only.
      total += 1;
      continue;
    }
    total += 1;
    if (key) cells[key] += 1;
  }
  return { code, label, scheme, cells, total };
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface TestRow {
  patientId: string;
  testType: ScreeningTestType;
  testedAt: Date;
  result: ScreeningResult;
  entryPoint: EntryPoint;
  isRetest: boolean;
  resultCollectedAt: Date | null;
  pregnancyId: string | null;
  partnerOfPregnancyId: string | null;
  referralSource: "none" | "asc" | "obc";
  treatedAt: Date | null;
  patient: Person;
}

export interface VisitRow {
  visitDate: Date;
  regimenCode: string;
  regimenLine: number;
  nextAppointmentDate: Date;
  isEmergencySupply: boolean;
  tbScreened: boolean;
  tbSymptomsPositive: boolean;
  tbTested: boolean;
  tbConfirmed: boolean;
  tbTreatmentStarted: boolean;
  iptStarted: boolean;
}

export interface EnrolmentRow {
  patientId: string;
  hivDiagnosisDate: Date | null;
  artStartDate: Date;
  enrolledAt: Date;
  entryPoint: EntryPoint;
  transferIn: "in_country" | "abroad" | null;
  pregnancyId: string | null;
  status: "active" | "transferred_out" | "dead" | "stopped";
  statusChangedAt: Date | null;
  transferOut: "in_country" | "abroad" | null;
  patient: Person;
  visits: VisitRow[];
}

export interface PregnancyRow {
  id: string;
  patientId: string;
  lastMenstrualPeriod: Date;
  expectedDueDate: Date;
  firstVisitDate: Date | null;
  deliveryDate: Date | null;
  hivKnownPositiveAtEntry: boolean;
  onArtAtEntry: boolean;
  hbvKnownPositiveAtEntry: boolean;
  referralSource: "none" | "asc" | "obc";
  newbornsAlive: number;
  patient: Person;
}

export interface InfantRow {
  patientId: string;
  bornInFacility: boolean;
  firstSeenAt: Date;
  nevirapineStartedAt: Date | null;
  cotrimoxazoleStartedAt: Date | null;
  visit6to8WeeksAt: Date | null;
  patient: Person;
}

export interface ViralLoadRow {
  patientId: string;
  program: "hiv" | "hbv" | "hcv";
  sampledAt: Date;
  value: number | null;
  belowDetection: boolean;
  pregnancyId: string | null;
  patient: Person;
}

export interface HepatitisRow {
  patientId: string;
  type: "hbv" | "hcv";
  diagnosedAt: Date;
  deltaPositive: boolean | null;
  eligibleAt: Date | null;
  treatmentStartedAt: Date | null;
  treatmentStoppedAt: Date | null;
  curedAt: Date | null;
  cirrhosisAt: Date | null;
  liverCancerAt: Date | null;
  diedAt: Date | null;
  patient: Person;
}

export interface TbRow {
  patientId: string;
  notificationDate: Date;
  outcomeDate: Date | null;
}

export interface Rma3HivInput {
  start: Date;
  end: Date;
  // Every test / enrolment / pregnancy needed (history included: "known positive" and the
  // ART follow-up look back before the month).
  tests: readonly TestRow[];
  enrolments: readonly EnrolmentRow[];
  pregnancies: readonly PregnancyRow[];
  infants: readonly InfantRow[];
  viralLoads: readonly ViralLoadRow[];
  hepatitis: readonly HepatitisRow[];
  tbCases: readonly TbRow[];
}

export interface Rma3HivReport {
  hivTesting: IndicatorRow[]; // IV.1.1
  hivTestingByEntryPoint: { entryPoint: EntryPoint; tested: number; positive: number; startedArt: number }[];
  artFollowUp: IndicatorRow[]; // IV.1.2
  artByRegimen: { code: string; label: string; line: number; patients: number }[]; // IV.1.4
  tbHivOnArt: number; // IV.3-013
  pmtctAntenatal: IndicatorRow[]; // II.3.1
  antenatalScreening: IndicatorRow[]; // II.1.1-016..023
  pmtctMaternity: IndicatorRow[]; // II.3.2
  pmtctReferrals: IndicatorRow[]; // II.3.3
  pmtctViralLoad: IndicatorRow[]; // II.3.4
  pmtctPostnatal: IndicatorRow[]; // II.3.5
  hepatitisSti: IndicatorRow[]; // IV.1.3
}

const DAY = 86_400_000;

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildHivReport(input: Rma3HivInput): Rma3HivReport {
  const { start, end } = input;
  const inMonth = (d: Date | null | undefined): d is Date => Boolean(d) && d!.getTime() >= start.getTime() && d!.getTime() < end.getTime();
  const ev = (patientId: string, person: Person, at: Date): Counted => ({ patientId, person, at });

  // Known HIV-positive since (earliest positive HIV test or ART enrolment).
  const hivPositiveSince = new Map<string, Date>();
  const markHiv = (id: string, d: Date | null) => {
    if (!d) return;
    const prev = hivPositiveSince.get(id);
    if (!prev || d < prev) hivPositiveSince.set(id, d);
  };
  for (const t of input.tests) if ((t.testType === "hiv" || t.testType === "hiv_pcr") && t.result === "positive") markHiv(t.patientId, t.testedAt);
  for (const e of input.enrolments) markHiv(e.patientId, e.hivDiagnosisDate ?? e.artStartDate);
  for (const p of input.pregnancies) if (p.hivKnownPositiveAtEntry) markHiv(p.patientId, p.firstVisitDate ?? p.lastMenstrualPeriod);
  const knownHivBefore = (id: string, at: Date) => {
    const since = hivPositiveSince.get(id);
    return Boolean(since && since.getTime() < at.getTime());
  };
  const hivPositiveBy = (id: string, at: Date) => {
    const since = hivPositiveSince.get(id);
    return Boolean(since && since.getTime() <= at.getTime());
  };

  const monthTests = input.tests.filter((t) => inMonth(t.testedAt));
  const hivTests = monthTests.filter((t) => t.testType === "hiv");
  const read = (t: TestRow) => t.result !== "invalid";
  const enrolmentByPatient = new Map(input.enrolments.map((e) => [e.patientId, e]));
  const startedArtInMonth = (e: EnrolmentRow) => inMonth(e.artStartDate) && !e.transferIn;

  // ── IV.1.1 HIV testing ─────────────────────────────────────────────────
  const newlyPositive = hivTests.filter((t) => t.result === "positive" && !knownHivBefore(t.patientId, t.testedAt));
  const hivTesting = [
    indicator("IV.1.1-001", "Personnes testées VIH dans le mois", "hiv13", hivTests.filter(read).map((t) => ev(t.patientId, t.patient, t.testedAt))),
    indicator("IV.1.1-002", "Personnes ayant retiré leurs résultats", "hiv13", hivTests.filter((t) => t.resultCollectedAt).map((t) => ev(t.patientId, t.patient, t.testedAt))),
    indicator("IV.1.1-003", "Personnes testées positives (dont cas déjà connus)", "hiv13", hivTests.filter((t) => t.result === "positive").map((t) => ev(t.patientId, t.patient, t.testedAt))),
    indicator("IV.1.1-004", "Personnes nouvellement testées positives", "hiv13", newlyPositive.map((t) => ev(t.patientId, t.patient, t.testedAt))),
    indicator(
      "IV.1.1-005",
      "Nouvellement positives mises sous traitement",
      "hiv13",
      newlyPositive.filter((t) => {
        const e = enrolmentByPatient.get(t.patientId);
        return e && inMonth(e.artStartDate) && e.artStartDate.getTime() >= t.testedAt.getTime() - DAY;
      }).map((t) => ev(t.patientId, t.patient, t.testedAt))
    ),
    indicator("IV.1.1-006", "Résultats indéterminés", "hiv13", hivTests.filter((t) => t.result === "indeterminate").map((t) => ev(t.patientId, t.patient, t.testedAt))),
    // Samples (not persons): every test of the month, then the invalid ones.
    { ...samples("IV.1.1-007", "Échantillons testés", hivTests) },
    { ...samples("IV.1.1-008", "Échantillons avec résultat invalide", hivTests.filter((t) => t.result === "invalid")) },
  ];
  const entryPoints = [...new Set([...hivTests.map((t) => t.entryPoint), ...input.enrolments.filter(startedArtInMonth).map((e) => e.entryPoint)])];
  const hivTestingByEntryPoint = entryPoints.map((entryPoint) => ({
    entryPoint,
    tested: new Set(hivTests.filter((t) => t.entryPoint === entryPoint && read(t)).map((t) => t.patientId)).size,
    positive: new Set(hivTests.filter((t) => t.entryPoint === entryPoint && t.result === "positive").map((t) => t.patientId)).size,
    startedArt: input.enrolments.filter((e) => startedArtInMonth(e) && e.entryPoint === entryPoint).length,
  }));

  // ── IV.1.2 ART follow-up ───────────────────────────────────────────────
  const monthEnd = new Date(end.getTime() - 1);
  type Follow = { e: EnrolmentRow; last: VisitRow | null; daysLate: number; outBefore: boolean };
  const follow: Follow[] = input.enrolments
    .filter((e) => e.enrolledAt.getTime() < end.getTime())
    .map((e) => {
      const visits = e.visits.filter((v) => v.visitDate.getTime() < end.getTime());
      const last = visits.length ? visits[visits.length - 1] : null;
      const due = last ? last.nextAppointmentDate : e.enrolledAt;
      const outBefore = e.status !== "active" && Boolean(e.statusChangedAt) && e.statusChangedAt!.getTime() < end.getTime();
      return { e, last, daysLate: Math.floor((monthEnd.getTime() - due.getTime()) / DAY), outBefore };
    });
  const activeFile = follow.filter((f) => !f.outBefore && f.daysLate < 90);
  const at = (f: Follow) => ev(f.e.patientId, f.e.patient, monthEnd);
  const monthVisits = (f: Follow) => f.e.visits.filter((v) => inMonth(v.visitDate));
  const visitFlag = (f: Follow, flag: keyof VisitRow) => monthVisits(f).some((v) => v[flag] === true);
  const isNew = (f: Follow) => startedArtInMonth(f.e);
  const switched = (f: Follow) =>
    f.e.visits.some((v, i) => inMonth(v.visitDate) && v.regimenLine === 2 && i > 0 && f.e.visits[i - 1].regimenLine === 1);
  const returned = (f: Follow) =>
    f.e.visits.some((v, i) => inMonth(v.visitDate) && i > 0 && (v.visitDate.getTime() - f.e.visits[i - 1].nextAppointmentDate.getTime()) / DAY >= 90);
  const late = (min: number, max: number) => follow.filter((f) => !f.outBefore && f.daysLate >= min && f.daysLate < max);
  const outInMonth = (status: EnrolmentRow["status"], scope?: "in_country" | "abroad") =>
    follow.filter((f) => f.e.status === status && inMonth(f.e.statusChangedAt) && (!scope || f.e.transferOut === scope));
  const transferredIn = (scope: "in_country" | "abroad") => follow.filter((f) => f.e.transferIn === scope && inMonth(f.e.enrolledAt));

  const artFollowUp = [
    indicator("IV.1.2-001", "Anciennes PVVIH sous ARV ayant reçu leur traitement du mois", "hiv13", follow.filter((f) => !isNew(f) && f.e.enrolledAt < start && monthVisits(f).some((v) => !v.isEmergencySupply)).map(at)),
    indicator("IV.1.2-002", "Nouvelles PVVIH mises sous ARV", "hiv13", follow.filter(isNew).map(at)),
    indicator("IV.1.2-003", "Total PVVIH sous ARV (file active)", "hiv13", activeFile.map(at)),
    indicator("IV.1.2-004", "File active 1re ligne", "hiv13", activeFile.filter((f) => (f.last?.regimenLine ?? 1) === 1).map(at)),
    indicator("IV.1.2-005", "File active 2e ligne", "hiv13", activeFile.filter((f) => f.last?.regimenLine === 2).map(at)),
    indicator("IV.1.2-006", "File active 3e ligne", "hiv13", activeFile.filter((f) => f.last?.regimenLine === 3).map(at)),
    indicator("IV.1.2-007", "PVVIH passées de la 1re à la 2e ligne", "hiv13", follow.filter(switched).map(at)),
    indicator("IV.1.2-008", "Nouvelles PVVIH avec recherche des signes de TB", "hiv13", follow.filter((f) => isNew(f) && visitFlag(f, "tbScreened")).map(at)),
    indicator("IV.1.2-009", "Nouvelles PVVIH sous ARV initiées à l'INH", "hiv13", follow.filter((f) => isNew(f) && visitFlag(f, "iptStarted")).map(at)),
    indicator("IV.1.2-010", "PVVIH avec recherche des signes de TB", "hiv13", follow.filter((f) => visitFlag(f, "tbScreened")).map(at)),
    indicator("IV.1.2-011", "PVVIH avec signe clinique de TB positif", "hiv13", follow.filter((f) => visitFlag(f, "tbSymptomsPositive")).map(at)),
    indicator("IV.1.2-012", "PVVIH sous ARV dépistées pour la TB", "hiv13", follow.filter((f) => visitFlag(f, "tbTested")).map(at)),
    indicator("IV.1.2-013", "PVVIH sous ARV confirmées TB", "hiv13", follow.filter((f) => visitFlag(f, "tbConfirmed")).map(at)),
    indicator("IV.1.2-014", "PVVIH sous ARV mises sous antituberculeux", "hiv13", follow.filter((f) => visitFlag(f, "tbTreatmentStarted")).map(at)),
    indicator("IV.1.2-015", "Décès de PVVIH notifiés", "hiv13", outInMonth("dead").map(at)),
    indicator("IV.1.2-016", "PVVIH non venues chercher leur traitement (1 mois)", "hiv13", late(30, 60).map(at)),
    indicator("IV.1.2-017", "PVVIH non venues chercher leur traitement (2 mois)", "hiv13", late(60, 90).map(at)),
    indicator("IV.1.2-018", "Perdues de vue (3 mois et +)", "hiv13", late(90, Number.POSITIVE_INFINITY).map(at)),
    indicator("IV.1.2-019", "Transferts entrants (pays)", "hiv13", transferredIn("in_country").map(at)),
    indicator("IV.1.2-020", "Transferts entrants (hors pays)", "hiv13", transferredIn("abroad").map(at)),
    indicator("IV.1.2-021", "Transferts sortants (pays)", "hiv13", outInMonth("transferred_out", "in_country").map(at)),
    indicator("IV.1.2-022", "Transferts sortants (hors pays)", "hiv13", outInMonth("transferred_out", "abroad").map(at)),
    indicator("IV.1.2-023", "Retours sur traitement", "hiv13", follow.filter(returned).map(at)),
    indicator("IV.1.2-024", "Aides ponctuelles / dépannages", "hiv13", follow.filter((f) => visitFlag(f, "isEmergencySupply")).map(at)),
  ];

  const regimenCount = new Map<string, number>();
  for (const f of activeFile) if (f.last) regimenCount.set(f.last.regimenCode, (regimenCount.get(f.last.regimenCode) ?? 0) + 1);
  const artByRegimen = ART_REGIMENS.filter((r) => regimenCount.has(r.code)).map((r) => ({ code: r.code, label: r.label, line: r.line, patients: regimenCount.get(r.code)! }));

  const activeIds = new Set(activeFile.map((f) => f.e.patientId));
  const tbHivOnArt = new Set(input.tbCases.filter((c) => inMonth(c.notificationDate) && activeIds.has(c.patientId)).map((c) => c.patientId)).size;

  // ── PMTCT ──────────────────────────────────────────────────────────────
  const pregnancyById = new Map(input.pregnancies.map((p) => [p.id, p]));
  // A woman is pregnant at `d` between her LMP and her delivery (or due date + 6 weeks).
  const pregnantAt = (patientId: string, d: Date) =>
    input.pregnancies.some((p) => p.patientId === patientId && p.lastMenstrualPeriod <= d && d <= (p.deliveryDate ?? new Date(p.expectedDueDate.getTime() + 42 * DAY)));
  const anc = monthTests.filter((t) => t.pregnancyId && t.entryPoint === "antenatal");
  const ancHiv = anc.filter((t) => t.testType === "hiv");
  const mat = monthTests.filter((t) => t.entryPoint === "maternity");
  const matHiv = mat.filter((t) => t.testType === "hiv");
  const tEv = (t: TestRow) => ev(t.patientId, t.patient, t.testedAt);
  const firstContact = input.pregnancies.filter((p) => inMonth(p.firstVisitDate));
  const pEv = (p: PregnancyRow) => ev(p.patientId, p.patient, p.firstVisitDate ?? p.lastMenstrualPeriod);
  const partners = monthTests.filter((t) => t.partnerOfPregnancyId && t.testType === "hiv");
  const hivPosPregnantVisits = follow.filter((f) => monthVisits(f).some((v) => pregnantAt(f.e.patientId, v.visitDate)));
  const pregnantVisitFlag = (f: Follow, flag: keyof VisitRow) => monthVisits(f).some((v) => v[flag] === true && pregnantAt(f.e.patientId, v.visitDate));
  const fEv = (f: Follow) => ev(f.e.patientId, f.e.patient, monthEnd);

  const pmtctAntenatal = [
    indicator("II.3.1-002", "FEC ayant fait leur 1er test VIH pendant la grossesse", "ptme", ancHiv.filter((t) => !t.isRetest && read(t)).map(tEv)),
    indicator("II.3.1-003", "FEC ayant retiré le résultat du test VIH", "ptme", ancHiv.filter((t) => t.resultCollectedAt).map(tEv)),
    indicator("II.3.1-004", "FEC dont le 1er test VIH est positif", "ptme", ancHiv.filter((t) => !t.isRetest && t.result === "positive").map(tEv)),
    indicator("II.3.1-005", "FEC déjà connues VIH+ au 1er contact CPN", "ptme", firstContact.filter((p) => p.hivKnownPositiveAtEntry).map(pEv)),
    indicator("II.3.1-006", "FEC testées pour la syphilis", "ptme", anc.filter((t) => t.testType === "syphilis" && read(t)).map(tEv)),
    indicator("II.3.1-007", "FEC positives à la syphilis", "ptme", anc.filter((t) => t.testType === "syphilis" && t.result === "positive").map(tEv)),
    indicator("II.3.1-008", "FEC négatives au 1er contact re-testées VIH (CPN2-4)", "ptme", ancHiv.filter((t) => t.isRetest && read(t)).map(tEv)),
    indicator("II.3.1-009", "FEC re-testées dépistées VIH+ (CPN2-4)", "ptme", ancHiv.filter((t) => t.isRetest && t.result === "positive").map(tEv)),
    indicator("II.3.1-010", "Partenaires masculins testés VIH", "ptme", partners.filter(read).map(tEv)),
    indicator("II.3.1-011", "Partenaires masculins testés VIH+", "ptme", partners.filter((t) => t.result === "positive").map(tEv)),
    indicator("II.3.1-012", "FEC VIH+ ayant initié le TARV sur site", "ptme", follow.filter((f) => isNew(f) && pregnantAt(f.e.patientId, f.e.artStartDate)).map(fEv)),
    indicator("II.3.1-013", "FEC VIH+ déjà sous TARV au 1er contact", "ptme", firstContact.filter((p) => p.onArtAtEntry).map(pEv)),
    indicator("II.3.1-014", "FEC VIH+ ayant eu le dépistage clinique de la TB", "ptme", hivPosPregnantVisits.filter((f) => pregnantVisitFlag(f, "tbScreened")).map(fEv)),
    indicator("II.3.1-015", "FEC VIH+ diagnostiquées TB+", "ptme", hivPosPregnantVisits.filter((f) => pregnantVisitFlag(f, "tbConfirmed")).map(fEv)),
    indicator("II.3.1-016", "FEC VIH+ TB+ mises sous antituberculeux", "ptme", hivPosPregnantVisits.filter((f) => pregnantVisitFlag(f, "tbTreatmentStarted")).map(fEv)),
    indicator("II.3.1-017", "FEC VIH+ nouvellement sous TARV initiées à l'INH", "ptme", hivPosPregnantVisits.filter((f) => isNew(f) && pregnantVisitFlag(f, "iptStarted")).map(fEv)),
    indicator("II.3.1-018", "FEC VIH+ testées pour la syphilis", "ptme", anc.filter((t) => t.testType === "syphilis" && read(t) && hivPositiveBy(t.patientId, t.testedAt)).map(tEv)),
    indicator("II.3.1-019", "FEC VIH+ positives à la syphilis", "ptme", anc.filter((t) => t.testType === "syphilis" && t.result === "positive" && hivPositiveBy(t.patientId, t.testedAt)).map(tEv)),
    indicator("II.3.1-020", "FEC VIH+ testées pour l'hépatite B", "ptme", anc.filter((t) => t.testType === "hbsag" && read(t) && hivPositiveBy(t.patientId, t.testedAt)).map(tEv)),
    indicator("II.3.1-021", "FEC VIH+ positives à l'hépatite B", "ptme", anc.filter((t) => t.testType === "hbsag" && t.result === "positive" && hivPositiveBy(t.patientId, t.testedAt)).map(tEv)),
    indicator(
      "II.3.1-022",
      "FEC positives à la syphilis mises sous traitement",
      "ptme",
      input.tests.filter((t) => t.testType === "syphilis" && t.pregnancyId && t.result === "positive" && inMonth(t.treatedAt)).map((t) => ev(t.patientId, t.patient, t.treatedAt!))
    ),
  ];

  const antenatalScreening = [
    indicator("II.1.1-016", "Femmes ayant testé la syphilis en CPN1", "mother", anc.filter((t) => t.testType === "syphilis" && !t.isRetest && read(t)).map(tEv)),
    indicator("II.1.1-017", "Total femmes en CPN testées pour la syphilis", "mother", anc.filter((t) => t.testType === "syphilis" && read(t)).map(tEv)),
    indicator("II.1.1-018", "Cas de syphilis diagnostiqués chez les femmes enceintes", "mother", anc.filter((t) => t.testType === "syphilis" && t.result === "positive").map(tEv)),
    indicator(
      "II.1.1-019",
      "Cas de syphilis traités chez les femmes enceintes",
      "mother",
      input.tests.filter((t) => t.testType === "syphilis" && t.pregnancyId && t.result === "positive" && inMonth(t.treatedAt)).map((t) => ev(t.patientId, t.patient, t.treatedAt!))
    ),
    indicator("II.1.1-021", "FEC déjà connues séropositives à l'hépatite B en CPN1", "mother", firstContact.filter((p) => p.hbvKnownPositiveAtEntry).map(pEv)),
    indicator("II.1.1-022", "Femmes enceintes dépistées pour l'hépatite B en CPN", "mother", anc.filter((t) => t.testType === "hbsag" && read(t)).map(tEv)),
    indicator("II.1.1-023", "Femmes enceintes séropositives à l'hépatite B", "mother", anc.filter((t) => t.testType === "hbsag" && t.result === "positive").map(tEv)),
  ];

  const deliveries = input.pregnancies.filter((p) => inMonth(p.deliveryDate));
  const hivPosDeliveries = deliveries.filter((p) => hivPositiveBy(p.patientId, p.deliveryDate!));
  const infantAgeDays = (i: InfantRow, d: Date) => Math.floor((d.getTime() - i.patient.birthDate.getTime()) / DAY);
  const pmtctMaternity = [
    indicator("II.3.2-001", "FEC ayant fait leur 1er test VIH en salle d'accouchement", "none", matHiv.filter((t) => !t.isRetest && read(t)).map(tEv)),
    indicator("II.3.2-002", "FEC dont le 1er test VIH en salle d'accouchement est positif", "none", matHiv.filter((t) => !t.isRetest && t.result === "positive").map(tEv)),
    indicator("II.3.2-003", "FEC négatives en CPN re-testées en salle d'accouchement", "none", matHiv.filter((t) => t.isRetest && read(t)).map(tEv)),
    indicator("II.3.2-004", "FEC re-testées VIH+ en salle d'accouchement", "none", matHiv.filter((t) => t.isRetest && t.result === "positive").map(tEv)),
    indicator("II.3.2-005", "FEC VIH+ en salle d'accouchement ayant initié le TAR", "none", follow.filter((f) => isNew(f) && f.e.entryPoint === "maternity").map(fEv)),
    indicator("II.3.2-006", "Femmes VIH+ ayant accouché dans la FOSA", "none", hivPosDeliveries.map((p) => ev(p.patientId, p.patient, p.deliveryDate!))),
    // Children, not persons of the register: the live births of those deliveries.
    { code: "II.3.2-007", label: "Enfants nés de mères VIH+ dans la FOSA", scheme: "none" as const, cells: {}, total: hivPosDeliveries.reduce((sum, p) => sum + p.newbornsAlive, 0) },
    indicator("II.3.2-008", "Enfants nés de mères VIH+ hors FOSA venus avant 72 h", "none", input.infants.filter((i) => !i.bornInFacility && inMonth(i.firstSeenAt) && infantAgeDays(i, i.firstSeenAt) <= 3).map((i) => ev(i.patientId, i.patient, i.firstSeenAt))),
    indicator("II.3.2-009", "Enfants nés de mères VIH+ ayant débuté la névirapine avant 72 h", "none", input.infants.filter((i) => inMonth(i.nevirapineStartedAt) && infantAgeDays(i, i.nevirapineStartedAt!) <= 3).map((i) => ev(i.patientId, i.patient, i.nevirapineStartedAt!))),
    indicator("II.3.2-010", "FEC positives à la syphilis traitées (salle d'accouchement)", "none", input.tests.filter((t) => t.testType === "syphilis" && t.entryPoint === "maternity" && t.result === "positive" && inMonth(t.treatedAt)).map((t) => ev(t.patientId, t.patient, t.treatedAt!))),
  ];

  const referred = (source: "asc" | "obc") => firstContact.filter((p) => p.referralSource === source);
  const referredTests = (source: "asc" | "obc") => ancHiv.filter((t) => t.pregnancyId && pregnancyById.get(t.pregnancyId)?.referralSource === source);
  const pmtctReferrals = [
    indicator("II.3.3-001", "FEC référées par les ASC reçues en FOSA", "none", referred("asc").map(pEv)),
    indicator("II.3.3-002", "FEC référées par les ASC testées VIH", "none", referredTests("asc").filter(read).map(tEv)),
    indicator("II.3.3-003", "FEC référées par les ASC testées VIH+", "none", referredTests("asc").filter((t) => t.result === "positive").map(tEv)),
    indicator("II.3.3-004", "FEC référées par les OBC reçues en FOSA", "none", referred("obc").map(pEv)),
    indicator("II.3.3-005", "FEC référées par les OBC testées VIH", "none", referredTests("obc").filter(read).map(tEv)),
    indicator("II.3.3-006", "FEC référées par les OBC testées VIH+", "none", referredTests("obc").filter((t) => t.result === "positive").map(tEv)),
  ];

  // First HIV viral load of each pregnancy, when it falls in the month.
  const firstPregnancyVl = input.pregnancies.flatMap((p) => {
    const end_ = p.deliveryDate ?? new Date(p.expectedDueDate.getTime() + 42 * DAY);
    const vls = input.viralLoads
      .filter((v) => v.program === "hiv" && v.patientId === p.patientId && (v.pregnancyId === p.id || (v.sampledAt >= p.lastMenstrualPeriod && v.sampledAt <= end_)))
      .sort((a, b) => a.sampledAt.getTime() - b.sampledAt.getTime());
    return vls.length && inMonth(vls[0].sampledAt) ? [vls[0]] : [];
  });
  const pmtctViralLoad = [
    indicator("II.3.4-001", "FEC VIH+ ayant fait leur 1re charge virale de la grossesse", "none", firstPregnancyVl.map((v) => ev(v.patientId, v.patient, v.sampledAt))),
    indicator("II.3.4-002", "FEC VIH+ dont la 1re charge virale est supprimée", "none", firstPregnancyVl.filter((v) => isSuppressed("hiv", v.value, v.belowDetection)).map((v) => ev(v.patientId, v.patient, v.sampledAt))),
  ];

  // Exposed infants: PCR order and age at the test.
  const infantIds = new Set(input.infants.map((i) => i.patientId));
  const pcrs = input.tests.filter((t) => t.testType === "hiv_pcr" && infantIds.has(t.patientId)).sort((a, b) => a.testedAt.getTime() - b.testedAt.getTime());
  const pcrRank = new Map<TestRow, number>();
  const seenPcr = new Map<string, number>();
  for (const t of pcrs) {
    const n = (seenPcr.get(t.patientId) ?? 0) + 1;
    seenPcr.set(t.patientId, n);
    pcrRank.set(t, n);
  }
  const monthPcrs = pcrs.filter((t) => inMonth(t.testedAt));
  const ageWeeks = (t: TestRow) => Math.floor((t.testedAt.getTime() - t.patient.birthDate.getTime()) / (7 * DAY));
  const firstPcrEarly = monthPcrs.filter((t) => pcrRank.get(t) === 1 && ageWeeks(t) <= 8);
  const firstPcrLate = monthPcrs.filter((t) => pcrRank.get(t) === 1 && ageWeeks(t) > 8);
  const secondPcr = monthPcrs.filter((t) => pcrRank.get(t) === 2);
  const serology18 = monthTests.filter((t) => t.testType === "hiv" && infantIds.has(t.patientId) && ageInCompletedMonths(t.patient.birthDate, t.testedAt) >= 18);
  const enrolledAfter = (tests: readonly TestRow[]) =>
    follow.filter((f) => isNew(f) && tests.some((t) => t.patientId === f.e.patientId && t.result === "positive")).map(fEv);
  const postnatalHiv = monthTests.filter((t) => t.testType === "hiv" && t.entryPoint === "postnatal");
  const pmtctPostnatal = [
    indicator("II.3.5-002", "Enfants nés de mères VIH+ vus en consultation à 6-8 semaines", "none", input.infants.filter((i) => inMonth(i.visit6to8WeeksAt)).map((i) => ev(i.patientId, i.patient, i.visit6to8WeeksAt!))),
    indicator("II.3.5-003", "Enfants nés de mères VIH+ sous cotrimoxazole dès 6 semaines", "none", input.infants.filter((i) => inMonth(i.cotrimoxazoleStartedAt)).map((i) => ev(i.patientId, i.patient, i.cotrimoxazoleStartedAt!))),
    indicator("II.3.5-004", "Enfants nés de mères VIH+ dépistés par PCR à 6-8 semaines", "none", firstPcrEarly.filter(read).map(tEv)),
    indicator("II.3.5-005", "Enfants VIH+ diagnostiqués par PCR à 6-8 semaines", "none", firstPcrEarly.filter((t) => t.result === "positive").map(tEv)),
    indicator("II.3.5-006", "Enfants dépistés après 8 semaines (1re PCR)", "none", firstPcrLate.filter(read).map(tEv)),
    indicator("II.3.5-007", "Enfants VIH+ diagnostiqués après 8 semaines", "none", firstPcrLate.filter((t) => t.result === "positive").map(tEv)),
    indicator("II.3.5-008", "Enfants dépistés à 9 mois (2e PCR)", "none", secondPcr.filter(read).map(tEv)),
    indicator("II.3.5-009", "Enfants VIH+ diagnostiqués à 9 mois", "none", secondPcr.filter((t) => t.result === "positive").map(tEv)),
    indicator("II.3.5-010", "Enfants VIH+ (PCR) enrôlés au traitement ARV", "none", enrolledAfter(pcrs)),
    indicator("II.3.5-011", "Enfants testés en sérologie à 18 mois", "none", serology18.filter(read).map(tEv)),
    indicator("II.3.5-012", "Enfants positifs à la sérologie de 18 mois", "none", serology18.filter((t) => t.result === "positive").map(tEv)),
    indicator("II.3.5-013", "Enfants positifs à 18 mois enrôlés sous ARV", "none", enrolledAfter(input.tests.filter((t) => t.testType === "hiv" && infantIds.has(t.patientId) && ageInCompletedMonths(t.patient.birthDate, t.testedAt) >= 18))),
    indicator("II.3.5-014", "Femmes allaitantes testées VIH", "ptme", postnatalHiv.filter(read).map(tEv)),
    indicator("II.3.5-015", "Femmes allaitantes testées VIH+", "ptme", postnatalHiv.filter((t) => t.result === "positive").map(tEv)),
    indicator("II.3.5-016", "Femmes allaitantes VIH+ mises sous TARV", "ptme", follow.filter((f) => isNew(f) && f.e.entryPoint === "postnatal").map(fEv)),
  ];

  // ── IV.1.3 Hepatitis and STI ───────────────────────────────────────────
  const since = (type: ScreeningTestType, kind: "hbv" | "hcv") => {
    const m = new Map<string, Date>();
    const mark = (id: string, d: Date) => {
      const p = m.get(id);
      if (!p || d < p) m.set(id, d);
    };
    for (const t of input.tests) if (t.testType === type && t.result === "positive") mark(t.patientId, t.testedAt);
    for (const c of input.hepatitis) if (c.type === kind) mark(c.patientId, c.diagnosedAt);
    return m;
  };
  const hbvSince = since("hbsag", "hbv");
  const hcvSince = since("hcv", "hcv");
  const positiveBy = (m: Map<string, Date>, id: string, d: Date) => {
    const s = m.get(id);
    return Boolean(s && s.getTime() <= d.getTime());
  };
  const everTestedHiv = (id: string, d: Date) => input.tests.some((t) => t.patientId === id && t.testType === "hiv" && t.testedAt.getTime() <= d.getTime() && read(t));
  const hbs = monthTests.filter((t) => t.testType === "hbsag");
  const hcvTests = monthTests.filter((t) => t.testType === "hcv");
  const hdv = monthTests.filter((t) => t.testType === "hdv" && positiveBy(hbvSince, t.patientId, t.testedAt));
  const hepPositive = [...hbs, ...hcvTests].filter((t) => t.result === "positive");
  const hbvPos = hbs.filter((t) => t.result === "positive");
  const hcvPos = hcvTests.filter((t) => t.result === "positive");
  const activeTb = (id: string) => input.tbCases.some((c) => c.patientId === id && c.notificationDate < end && (!c.outcomeDate || c.outcomeDate >= start));
  const cEv = (c: HepatitisRow, d: Date) => ev(c.patientId, c.patient, d);
  const onTreatment = (c: HepatitisRow) =>
    Boolean(c.treatmentStartedAt && c.treatmentStartedAt < end && (!c.treatmentStoppedAt || c.treatmentStoppedAt >= start) && (!c.curedAt || c.curedAt >= start));
  const hbvCases = input.hepatitis.filter((c) => c.type === "hbv");
  const hcvCases = input.hepatitis.filter((c) => c.type === "hcv");
  const onArt = (id: string) => activeIds.has(id);
  const newCase = (c: HepatitisRow) => inMonth(c.diagnosedAt);
  const hepatitisSti = [
    indicator("IV.1.3-001", "Personnes dépistées pour les hépatites virales", "hep9", [...hbs, ...hcvTests].filter(read).map(tEv)),
    indicator("IV.1.3-002", "Personnes dépistées pour l'hépatite B", "hep9", hbs.filter(read).map(tEv)),
    indicator("IV.1.3-003", "Personnes dépistées pour l'hépatite C", "hep9", hcvTests.filter(read).map(tEv)),
    indicator("IV.1.3-004", "Personnes positives aux hépatites virales", "hep9", hepPositive.map(tEv)),
    indicator("IV.1.3-005", "Positives à l'hépatite B", "hep9", hbvPos.map(tEv)),
    indicator("IV.1.3-006", "Positives à l'hépatite C", "hep9", hcvPos.map(tEv)),
    indicator("IV.1.3-007", "Positives à l'hépatite B dépistées pour l'hépatite Delta", "hep9", hdv.filter(read).map(tEv)),
    indicator("IV.1.3-008", "Positives à l'hépatite B et Delta", "hep9", hdv.filter((t) => t.result === "positive").map(tEv)),
    indicator("IV.1.3-009", "Personnes ayant reçu un traitement antiviral anti-hépatite", "hep9", input.hepatitis.filter(onTreatment).map((c) => cEv(c, monthEnd))),
    indicator("IV.1.3-010", "Positifs aux hépatites avec tuberculose", "hep9", hepPositive.filter((t) => activeTb(t.patientId)).map(tEv)),
    indicator("IV.1.3-011", "Positifs aux hépatites testés pour le VIH", "hep9", hepPositive.filter((t) => everTestedHiv(t.patientId, monthEnd)).map(tEv)),
    indicator("IV.1.3-012", "Positifs aux hépatites co-infectés VIH", "hep9", hepPositive.filter((t) => hivPositiveBy(t.patientId, monthEnd)).map(tEv)),
    indicator("IV.1.3-013", "Positifs à l'hépatite B testés pour le VIH", "hep9", hbvPos.filter((t) => everTestedHiv(t.patientId, monthEnd)).map(tEv)),
    indicator("IV.1.3-014", "Positifs à l'hépatite B co-infectés VIH", "hep9", hbvPos.filter((t) => hivPositiveBy(t.patientId, monthEnd)).map(tEv)),
    indicator("IV.1.3-015", "Positifs à l'hépatite C testés pour le VIH", "hep9", hcvPos.filter((t) => everTestedHiv(t.patientId, monthEnd)).map(tEv)),
    indicator("IV.1.3-016", "Positifs à l'hépatite C co-infectés VIH", "hep9", hcvPos.filter((t) => hivPositiveBy(t.patientId, monthEnd)).map(tEv)),
    indicator("IV.1.3-017", "Co-infections hépatite C / hépatite B", "hep9", hepPositive.filter((t) => positiveBy(hbvSince, t.patientId, monthEnd) && positiveBy(hcvSince, t.patientId, monthEnd)).map(tEv)),
    indicator("IV.1.3-018", "VHC+ avec charge virale faite", "hep9", input.viralLoads.filter((v) => v.program === "hcv" && inMonth(v.sampledAt)).map((v) => ev(v.patientId, v.patient, v.sampledAt))),
    indicator("IV.1.3-019", "VHC+ éligibles au traitement", "hep9", hcvCases.filter((c) => inMonth(c.eligibleAt)).map((c) => cEv(c, c.eligibleAt!))),
    indicator("IV.1.3-020", "VHC+ sous traitement", "hep9", hcvCases.filter(onTreatment).map((c) => cEv(c, monthEnd))),
    indicator("IV.1.3-021", "Nouveaux VHB+ éligibles au traitement", "hep9", hbvCases.filter((c) => newCase(c) && c.eligibleAt && c.eligibleAt < end).map((c) => cEv(c, c.diagnosedAt))),
    indicator("IV.1.3-022", "Nouveaux VHB+ sous traitement", "hep9", hbvCases.filter((c) => newCase(c) && onTreatment(c)).map((c) => cEv(c, c.diagnosedAt))),
    indicator("IV.1.3-023", "Anciens VHB+ sous TARV traités", "hep9", hbvCases.filter((c) => !newCase(c) && c.diagnosedAt < start && onArt(c.patientId)).map((c) => cEv(c, monthEnd))),
    indicator("IV.1.3-024", "Nouveaux VHB+ sous TARV traités", "hep9", hbvCases.filter((c) => newCase(c) && onArt(c.patientId)).map((c) => cEv(c, c.diagnosedAt))),
    indicator("IV.1.3-025", "Total VHB+ sous TARV traités", "hep9", hbvCases.filter((c) => c.diagnosedAt < end && onArt(c.patientId)).map((c) => cEv(c, monthEnd))),
    indicator("IV.1.3-026", "VHB+ sous antiviraux anti-hépatite B Delta", "hep9", hbvCases.filter((c) => c.deltaPositive === true && onTreatment(c)).map((c) => cEv(c, monthEnd))),
    indicator("IV.1.3-027", "VHB+ avec suppression de la charge virale", "hep9", input.viralLoads.filter((v) => v.program === "hbv" && inMonth(v.sampledAt) && isSuppressed("hbv", v.value, v.belowDetection)).map((v) => ev(v.patientId, v.patient, v.sampledAt))),
    indicator("IV.1.3-028", "Guéris de l'hépatite C", "hep9", hcvCases.filter((c) => inMonth(c.curedAt)).map((c) => cEv(c, c.curedAt!))),
    indicator("IV.1.3-029", "Cirrhoses post-hépatite C", "hep9", hcvCases.filter((c) => inMonth(c.cirrhosisAt)).map((c) => cEv(c, c.cirrhosisAt!))),
    indicator("IV.1.3-030", "Cancers du foie post-hépatite C", "hep9", hcvCases.filter((c) => inMonth(c.liverCancerAt)).map((c) => cEv(c, c.liverCancerAt!))),
    indicator("IV.1.3-031", "Cirrhoses post-hépatite B", "hep9", hbvCases.filter((c) => c.deltaPositive !== true && inMonth(c.cirrhosisAt)).map((c) => cEv(c, c.cirrhosisAt!))),
    indicator("IV.1.3-032", "Cirrhoses post-hépatite B Delta", "hep9", hbvCases.filter((c) => c.deltaPositive === true && inMonth(c.cirrhosisAt)).map((c) => cEv(c, c.cirrhosisAt!))),
    indicator("IV.1.3-033", "Cancers du foie post-hépatite B", "hep9", hbvCases.filter((c) => c.deltaPositive !== true && inMonth(c.liverCancerAt)).map((c) => cEv(c, c.liverCancerAt!))),
    indicator("IV.1.3-034", "Cancers du foie post-hépatite B Delta", "hep9", hbvCases.filter((c) => c.deltaPositive === true && inMonth(c.liverCancerAt)).map((c) => cEv(c, c.liverCancerAt!))),
    indicator("IV.1.3-035", "Décès par hépatite C", "hep9", hcvCases.filter((c) => inMonth(c.diedAt)).map((c) => cEv(c, c.diedAt!))),
    indicator("IV.1.3-036", "Décès par hépatite B", "hep9", hbvCases.filter((c) => inMonth(c.diedAt)).map((c) => cEv(c, c.diedAt!))),
    indicator("IV.1.3-037", "Personnes porteuses d'IST (total)", "hep9", monthTests.filter((t) => STI_TEST_TYPES.includes(t.testType) && t.result === "positive").map(tEv)),
    ...STI_ROWS.flatMap(([type, screenedCode, positiveCode, name]) => [
      indicator(screenedCode, `Dépistées ${name}`, "hep9", monthTests.filter((t) => t.testType === type && read(t)).map(tEv)),
      indicator(positiveCode, `Positives ${name}`, "hep9", monthTests.filter((t) => t.testType === type && t.result === "positive").map(tEv)),
    ]),
  ];

  return {
    hivTesting,
    hivTestingByEntryPoint,
    artFollowUp,
    artByRegimen,
    tbHivOnArt,
    pmtctAntenatal,
    antenatalScreening,
    pmtctMaternity,
    pmtctReferrals,
    pmtctViralLoad,
    pmtctPostnatal,
    hepatitisSti,
  };
}

const STI_ROWS: [ScreeningTestType, string, string, string][] = [
  ["chlamydia", "IV.1.3-038", "IV.1.3-039", "Chlamydia"],
  ["mycoplasma", "IV.1.3-040", "IV.1.3-041", "mycoplasme"],
  ["syphilis", "IV.1.3-042", "IV.1.3-043", "syphilis"],
  ["gonorrhea", "IV.1.3-044", "IV.1.3-045", "gonococcie"],
  ["other_sti", "IV.1.3-046", "IV.1.3-047", "autres IST"],
];

// Samples are counted, not persons.
function samples(code: string, label: string, tests: readonly TestRow[]): IndicatorRow {
  const config = SCHEMES.hiv13;
  const cells = emptyCells(disaggregationColumns(config));
  for (const t of tests) {
    const key = disaggregationKey(config, t.patient, t.testedAt);
    if (key) cells[key] += 1;
  }
  return { code, label, scheme: "hiv13", cells, total: tests.length };
}
