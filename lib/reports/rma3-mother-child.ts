import { PROVISIONAL_AGE_SCHEMES, RMA3_AGE_SCHEMES, ageBand, type DisaggregationColumn } from "@/lib/reports/age-bands";
import { DAY, HOUR, ageSexBreakdown, inRange, isPregnantAt, row, sexColumns, type ActivityTable, type Breakdown, type Person, type PregnancyPeriod } from "@/lib/reports/activity-rows";
import { FP_METHODS } from "@/lib/family-planning/methods";

// RMA3 mother-and-child complements (II.1.1 to II.1.5, III.9): outreach antenatal care, Td
// doses, haemoglobin, GATPA, the RMA3 delivery complications, abortion care, maternal deaths
// by cause and review, post-natal contacts, newborn care and deaths, family planning. Pure,
// unit-tested in rma3-mother-child.test.ts. Counting conventions: activity-rows.ts.
//
// Definitions (to validate with the programme):
//  - post-natal contacts by days since the delivery: 0-48 h, day 6-10, 6 weeks = day 35-49;
//  - gestational age at birth = completed weeks between the LMP and the delivery;
//    premature = 28 to < 37 weeks; low birth weight at term = < 2 500 g at ≥ 37 weeks;
//  - asphyxia = Apgar at 5 minutes < 7;
//  - immediate post-partum family planning = method started within 48 h of the delivery.

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface McAntenatalVisit {
  patientId: string;
  visitDate: Date;
  strategy: "fixed" | "outreach";
  hemoglobinMeasured: boolean;
  patient: Person;
}

// A Td dose of the vaccination register: counted in II.1.1 when given at an antenatal visit
// or to a woman pregnant at that date.
export interface McTdDose {
  patientId: string;
  at: Date;
  doseNumber: number;
  fromAntenatalVisit: boolean;
  patient: Person;
  pregnancies: PregnancyPeriod[];
}

export type BreastfeedingStart = "within_30_min" | "within_1_hour" | "later" | "not_started";

export interface McDelivery {
  patientId: string;
  deliveryDate: Date;
  amtsl: boolean;
  complications: string[];
  complicationsManaged: boolean;
  breastfeedingStart: BreastfeedingStart | null;
  patient: Person;
}

export interface McPregnancyEnd {
  patientId: string;
  endedAt: Date;
  abortionCare: "uncomplicated" | "complicated" | null;
  patient: Person;
}

export interface McMaternalDeath {
  patientId: string;
  at: Date;
  cause: string | null;
  reviewedAt: Date | null;
  patient: Person;
}

export interface McPostnatalVisit {
  patientId: string;
  visitDate: Date;
  deliveryDate: Date;
  vitaminAGiven: boolean;
  ironFolateGiven: boolean;
  breastfeedingCounseling: boolean;
  newbornExamined: boolean;
  // Newborns of the delivery born alive and not dead before the visit.
  newborns: { id: string; sex: string }[];
  patient: Person;
}

export interface McNewborn {
  id: string;
  sex: string;
  outcome: string;
  deliveryDate: Date;
  lastMenstrualPeriod: Date | null;
  birthWeightGrams: number | null;
  apgarScore5Min: number | null;
  bagMaskVentilation: boolean;
  kangarooCare: boolean;
  incubatorCare: boolean;
  stillbirthType: "fresh" | "macerated" | null;
  breastfeedingStart: BreastfeedingStart | null;
  // Death of a live-born baby (newborn record, or its patient file), null if alive.
  diedAt: Date | null;
  deathCause: string | null;
  deathReviewedAt: Date | null;
}

export interface McFpVisit {
  id: string;
  patientId: string;
  visitDate: Date;
  clientStatus: "new_user" | "continuing_user";
  counseled: boolean;
  methodCode: string | null;
  isPostpartum: boolean;
  referredByChw: boolean;
  // The patient's most recent delivery before the visit (immediate post-partum).
  lastDeliveryDate: Date | null;
  patient: Person;
}

export interface Rma3MotherChildInput {
  start: Date;
  end: Date;
  antenatalVisits: McAntenatalVisit[];
  tdDoses: McTdDose[];
  deliveries: McDelivery[];
  pregnancyEnds: McPregnancyEnd[];
  maternalDeaths: McMaternalDeath[];
  postnatalVisits: McPostnatalVisit[];
  newborns: McNewborn[]; // born, dead or reviewed this month
  fpVisits: McFpVisit[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type PersonEvent = { id: string; at: Date; person: Person };
type BabyEvent = { id: string; at: Date; sex: string };

const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY);

export function gestationalWeeksAtBirth(lastMenstrualPeriod: Date | null, deliveryDate: Date): number | null {
  if (!lastMenstrualPeriod) return null;
  return Math.floor((deliveryDate.getTime() - lastMenstrualPeriod.getTime()) / (7 * DAY));
}

// RMA3 post-natal contact of a visit, from the delivery date.
export function postnatalContact(deliveryDate: Date, visitDate: Date): "h48" | "d6to10" | "w6" | null {
  if (visitDate.getTime() - deliveryDate.getTime() <= 48 * HOUR) return "h48";
  const days = daysBetween(deliveryDate, visitDate);
  if (days >= 6 && days <= 10) return "d6to10";
  if (days >= 35 && days <= 49) return "w6";
  return null;
}

const FP_STATUS = [
  { key: "new_user", label: "NU" },
  { key: "continuing_user", label: "AU" },
] as const;

// II.1.5: FP age bands (PROVISIONAL) × new user (NU) / continuing user (AU).
function fpBreakdown(): Breakdown<PersonEvent & { status: string }> {
  const bands = PROVISIONAL_AGE_SCHEMES.fp;
  const columns: DisaggregationColumn[] = bands.flatMap((b) => FP_STATUS.map((s) => ({ key: `${b.key}_${s.key}`, label: `${b.label} ${s.label}` })));
  return {
    columns,
    keyOf: (e) => {
      const band = ageBand(bands, e.person.birthDate, e.at);
      return band ? `${band}_${e.status}` : "";
    },
  };
}

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildMotherChildTables(input: Rma3MotherChildInput): ActivityTable[] {
  const inMonth = inRange(input.start, input.end);
  const mother = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.mother, false);
  const babies: Breakdown<BabyEvent> = { columns: sexColumns, keyOf: (e) => (e.sex === "M" || e.sex === "F" ? e.sex : "") };
  const none: Breakdown<{ id: string; at: Date }> = { columns: [], keyOf: () => "" };

  // ── II.1.1 complements ──
  const visits = input.antenatalVisits.filter((v) => inMonth(v.visitDate));
  const visitEv = (v: McAntenatalVisit): PersonEvent => ({ id: v.patientId, at: v.visitDate, person: v.patient });
  const tdDoses = input.tdDoses.filter((d) => inMonth(d.at) && (d.fromAntenatalVisit || isPregnantAt(d.pregnancies, d.at)));
  const tdRow = (n: number) =>
    row(`II.1.1-0${9 + n}`, `Femmes ayant reçu la ${n === 1 ? "1re" : `${n}e`} dose de Td`, mother, tdDoses.filter((d) => d.doseNumber === n).map((d) => ({ id: d.patientId, at: d.at, person: d.patient })), true);

  const antenatal: ActivityTable = {
    section: "II.1.1",
    title: "CPN : stratégie avancée, Td et hémoglobine",
    columns: mother.columns,
    rows: [
      row("II.1.1-005", "Femmes enceintes vues en CPN en stratégie avancée", mother, visits.filter((v) => v.strategy === "outreach").map(visitEv), true),
      ...[1, 2, 3, 4, 5].map(tdRow),
      row("II.1.1-020", "Femmes en CPN avec taux d'hémoglobine mesuré", mother, visits.filter((v) => v.hemoglobinMeasured).map(visitEv), true),
    ],
    note: "Td = doses du registre de vaccination (groupe TD) données en CPN ou à une femme enceinte, au rang saisi (1 à 5).",
  };

  // ── II.1.2 complements ──
  const deliveries = input.deliveries.filter((d) => inMonth(d.deliveryDate));
  const deliveryEv = (d: McDelivery): PersonEvent => ({ id: `${d.patientId}:${d.deliveryDate.getTime()}`, at: d.deliveryDate, person: d.patient });
  const withComplication = (c: string) => deliveries.filter((d) => d.complications.includes(c)).map(deliveryEv);
  const ends = input.pregnancyEnds.filter((e) => inMonth(e.endedAt));
  const endEv = (e: McPregnancyEnd): PersonEvent => ({ id: `${e.patientId}:${e.endedAt.getTime()}`, at: e.endedAt, person: e.patient });
  const deaths = input.maternalDeaths.filter((d) => inMonth(d.at));
  const deathEv = (d: McMaternalDeath): PersonEvent => ({ id: d.patientId, at: d.at, person: d.patient });
  const deathsBy = (cause: string) => deaths.filter((d) => d.cause === cause).map(deathEv);
  const immediateFp = input.fpVisits.filter(
    (v) => inMonth(v.visitDate) && v.isPostpartum && v.methodCode && v.lastDeliveryDate && v.visitDate.getTime() - v.lastDeliveryDate.getTime() <= 48 * HOUR
  );

  const deliveryTable: ActivityTable = {
    section: "II.1.2",
    title: "Accouchements : GATPA, complications, avortements et décès maternels",
    columns: mother.columns,
    rows: [
      row("II.1.2-003", "Femmes ayant bénéficié de la GATPA", mother, deliveries.filter((d) => d.amtsl).map(deliveryEv), false),
      row("II.1.2-007", "dont pré-éclampsie / éclampsie", mother, withComplication("eclampsia"), false),
      row("II.1.2-008", "dont ruptures utérines", mother, withComplication("uterine_rupture"), false),
      row("II.1.2-009", "dont infections puerpérales", mother, withComplication("puerperal_infection"), false),
      row("II.1.2-011", "Complications obstétricales prises en charge", mother, deliveries.filter((d) => d.complicationsManaged).map(deliveryEv), false),
      row("II.1.2-012", "Complications d'avortements enregistrées", mother, ends.filter((e) => e.abortionCare === "complicated").map(endEv), false),
      row("II.1.2-013", "Soins après avortement non compliqué", mother, ends.filter((e) => e.abortionCare === "uncomplicated").map(endEv), false),
      row("II.1.2-014", "Soins après avortement compliqué (avortements incomplets)", mother, ends.filter((e) => e.abortionCare === "complicated").map(endEv), false),
      row("II.1.2-017", "Décès maternels revus", mother, input.maternalDeaths.filter((d) => inMonth(d.reviewedAt)).map((d) => ({ ...deathEv(d), at: d.reviewedAt! })), true),
      row("II.1.2-018", "Décès des suites d'avortement", mother, deathsBy("abortion"), true),
      row("II.1.2-019", "Décès maternels dus aux hémorragies", mother, deathsBy("hemorrhage"), true),
      row("II.1.2-020", "dus au travail prolongé / dystocie", mother, deathsBy("obstructed_labour"), true),
      row("II.1.2-021", "dus à la pré-éclampsie / éclampsie", mother, deathsBy("preeclampsia_eclampsia"), true),
      row("II.1.2-022", "dus aux ruptures utérines", mother, deathsBy("uterine_rupture"), true),
      row("II.1.2-023", "dus aux infections puerpérales", mother, deathsBy("puerperal_infection"), true),
      row("II.1.2-024", "dus à d'autres causes", mother, deathsBy("other"), true),
      row("II.1.2-025", "Femmes (FOSA) ayant initié l'allaitement dans les 30 min post-partum", mother, deliveries.filter((d) => d.breastfeedingStart === "within_30_min").map(deliveryEv), false),
      row("II.1.2-027", "Femmes ayant débuté une méthode PF en post-partum immédiat", mother, immediateFp.map((v) => ({ id: v.patientId, at: v.visitDate, person: v.patient })), true),
    ],
    note: "Décès maternels par cause : ceux dont la cause est saisie sur la grossesse (date du décès dans le mois). Post-partum immédiat = méthode PF débutée dans les 48 h suivant l'accouchement.",
  };

  // ── II.1.3 post-natal ──
  const pnc = input.postnatalVisits.filter((v) => inMonth(v.visitDate));
  const pncEv = (v: McPostnatalVisit): PersonEvent => ({ id: v.patientId, at: v.visitDate, person: v.patient });
  const atContact = (contact: "h48" | "d6to10" | "w6") => pnc.filter((v) => postnatalContact(v.deliveryDate, v.visitDate) === contact);
  const postnatal: ActivityTable = {
    section: "II.1.3",
    title: "Consultations post-natales",
    columns: mother.columns,
    rows: [
      row("II.1.3-002", "Femmes ayant bénéficié de la CPoN entre J6 et J10", mother, atContact("d6to10").map(pncEv), true),
      row("II.1.3-003", "Femmes ayant bénéficié de la CPoN à 6 semaines", mother, atContact("w6").map(pncEv), true),
      row("II.1.3-004", "Femmes ayant reçu la vitamine A en post-partum", mother, pnc.filter((v) => v.vitaminAGiven).map(pncEv), true),
      row("II.1.3-005", "Femmes ayant reçu le fer / acide folique en post-partum", mother, pnc.filter((v) => v.ironFolateGiven).map(pncEv), true),
      row("II.1.3-006", "Couples mère / nouveau-né ayant bénéficié du counseling sur l'allaitement dans les 48 h", mother, atContact("h48").filter((v) => v.breastfeedingCounseling).map(pncEv), true),
    ],
    note: "Contact post-natal selon le délai depuis l'accouchement : 0-48 h, J6 à J10, 6 semaines = J35 à J49.",
  };

  // ── II.1.4 newborns ──
  const born = input.newborns.filter((n) => inMonth(n.deliveryDate));
  const liveBorn = born.filter((n) => n.outcome !== "stillbirth");
  const birthEv = (n: McNewborn): BabyEvent => ({ id: n.id, at: n.deliveryDate, sex: n.sex });
  const ga = (n: McNewborn) => gestationalWeeksAtBirth(n.lastMenstrualPeriod, n.deliveryDate);
  const premature = (n: McNewborn) => {
    const weeks = ga(n);
    return weeks !== null && weeks >= 28 && weeks < 37;
  };
  const lowWeight = (n: McNewborn) => n.birthWeightGrams !== null && n.birthWeightGrams < 2500;
  const asphyxia = (n: McNewborn) => n.apgarScore5Min !== null && n.apgarScore5Min < 7;
  const neonatalDeaths = input.newborns.filter((n) => n.diedAt && inMonth(n.diedAt) && n.diedAt.getTime() - n.deliveryDate.getTime() <= 28 * DAY);
  const deathEvOf = (n: McNewborn): BabyEvent => ({ id: n.id, at: n.diedAt!, sex: n.sex });
  const diedWithin = (ms: number) => neonatalDeaths.filter((n) => n.diedAt!.getTime() - n.deliveryDate.getTime() < ms).map(deathEvOf);
  const diedOf = (cause: string) => neonatalDeaths.filter((n) => n.deathCause === cause).map(deathEvOf);
  const examinedBabies = (contact: "h48" | "d6to10") =>
    atContact(contact)
      .filter((v) => v.newbornExamined)
      .flatMap((v) => v.newborns.map((b) => ({ id: b.id, at: v.visitDate, sex: b.sex })));

  const newborns: ActivityTable = {
    section: "II.1.4",
    title: "Nouveau-nés : soins post-nataux, prématurité, réanimation, mort-nés et décès",
    columns: sexColumns,
    rows: [
      row("II.1.4-003", "Nouveau-nés ayant bénéficié de la CPoN dans les 48 h", babies, examinedBabies("h48"), true),
      row("II.1.4-004", "Nouveau-nés ayant bénéficié de la CPoN entre J6 et J10", babies, examinedBabies("d6to10"), true),
      row("II.1.4-005", "Nouveau-nés prématurés (28 à < 37 SA) enregistrés", babies, liveBorn.filter(premature).map(birthEv), false),
      row("II.1.4-006", "Naissances vivantes de petit poids (< 2 500 g) nées à terme", babies, liveBorn.filter((n) => lowWeight(n) && (ga(n) ?? 0) >= 37).map(birthEv), false),
      row("II.1.4-007", "Nouveau-nés prématurés pris en charge par la méthode kangourou", babies, liveBorn.filter((n) => premature(n) && n.kangarooCare).map(birthEv), false),
      row("II.1.4-008", "Nouveau-nés de faible poids pris en charge par la méthode kangourou", babies, liveBorn.filter((n) => lowWeight(n) && n.kangarooCare).map(birthEv), false),
      row("II.1.4-009", "Nouveau-nés prématurés / de faible poids pris en charge en couveuse", babies, liveBorn.filter((n) => (premature(n) || lowWeight(n)) && n.incubatorCare).map(birthEv), false),
      row("II.1.4-010", "Nouveau-nés asphyxiés à la naissance", babies, liveBorn.filter(asphyxia).map(birthEv), false),
      row("II.1.4-011", "Nouveau-nés asphyxiés réanimés au masque et ballon", babies, liveBorn.filter((n) => asphyxia(n) && n.bagMaskVentilation).map(birthEv), false),
      row("II.1.4-014", "dont mort-nés frais", babies, born.filter((n) => n.outcome === "stillbirth" && n.stillbirthType === "fresh").map(birthEv), false),
      row("II.1.4-015", "dont mort-nés macérés", babies, born.filter((n) => n.outcome === "stillbirth" && n.stillbirthType === "macerated").map(birthEv), false),
      row("II.1.4-016", "Décès de nouveau-nés dans les 24 premières heures", babies, diedWithin(24 * HOUR), false),
      row("II.1.4-017", "Décès de nouveau-nés dans la 1re semaine de vie", babies, diedWithin(7 * DAY), false),
      row("II.1.4-018", "Décès néonataux (0-28 j) enregistrés (FOSA)", babies, neonatalDeaths.map(deathEvOf), false),
      row("II.1.4-019", "Décès de nouveau-nés dus à la prématurité", babies, diedOf("prematurity"), false),
      row("II.1.4-020", "dus à l'asphyxie", babies, diedOf("asphyxia"), false),
      row("II.1.4-021", "dus aux infections néonatales", babies, diedOf("infection"), false),
      row("II.1.4-022", "dus à d'autres causes", babies, diedOf("other"), false),
      row("II.1.4-023", "Décès néonataux revus", babies, input.newborns.filter((n) => inMonth(n.deathReviewedAt)).map((n) => ({ id: n.id, at: n.deathReviewedAt!, sex: n.sex })), false),
    ],
    note: "Âge gestationnel à la naissance calculé depuis la DDR : prématuré = 28 à < 37 SA ; petit poids à terme = < 2 500 g à 37 SA et plus. Asphyxie = Apgar à 5 min < 7. Décès comptés le mois du décès.",
  };

  // ── III.9 breastfeeding ──
  const breastfeeding: ActivityTable = {
    section: "III.9",
    title: "Allaitement maternel",
    columns: [],
    rows: [
      row(
        "III.9-001",
        "Enfants mis au sein dans l'heure suivant la naissance",
        none,
        liveBorn.filter((n) => n.breastfeedingStart === "within_30_min" || n.breastfeedingStart === "within_1_hour").map(birthEv),
        false
      ),
    ],
  };

  // ── II.1.5 family planning ──
  const fp = fpBreakdown();
  const fpVisits = input.fpVisits.filter((v) => inMonth(v.visitDate));
  const fpEv = (v: McFpVisit) => ({ id: v.patientId, at: v.visitDate, person: v.patient, status: v.clientStatus });
  const fpActivity: ActivityTable = {
    section: "II.1.5",
    title: "Planification familiale",
    columns: fp.columns,
    rows: [
      row("II.1.5-001", "Visites (consultations) de planification familiale", fp, fpVisits.map((v) => ({ ...fpEv(v), id: v.id })), false),
      row("II.1.5-002", "Clients conseillés en PF", fp, fpVisits.filter((v) => v.counseled).map(fpEv), true),
      row("II.1.5-003", "Nouvelles acceptantes de PF", fp, fpVisits.filter((v) => v.clientStatus === "new_user" && v.methodCode).map(fpEv), true),
      row("II.1.5-004", "Clients référés par un ASC", fp, fpVisits.filter((v) => v.referredByChw).map(fpEv), true),
    ],
    note: "NU = nouvel utilisateur, AU = ancien utilisateur. Tranches d'âge PF PROVISOIRES (10-14 / 15-19 / 20-24 / 25 ans et +), à valider avec le formulaire officiel.",
  };
  const fpMethods: ActivityTable = {
    section: "II.1.5",
    title: "Utilisateurs par méthode contraceptive",
    columns: fp.columns,
    rows: FP_METHODS.map((m) => row(`II.1.5-006/${m.code}`, m.label, fp, fpVisits.filter((v) => v.methodCode === m.code).map(fpEv), true)),
    note: "Méthodes du protocole national du MINSANTE (section 1.1.3) : liste à rapprocher des « 16 méthodes » du formulaire RMA3.",
  };
  const fpPostpartum: ActivityTable = {
    section: "II.1.5",
    title: "Utilisatrices ayant choisi une méthode en post-partum",
    columns: fp.columns,
    rows: FP_METHODS.filter((m) => m.postpartum).map((m) =>
      row(`II.1.5-007/${m.code}`, m.label, fp, fpVisits.filter((v) => v.isPostpartum && v.methodCode === m.code).map(fpEv), true)
    ),
  };

  return [antenatal, deliveryTable, postnatal, newborns, breastfeeding, fpActivity, fpMethods, fpPostpartum];
}
