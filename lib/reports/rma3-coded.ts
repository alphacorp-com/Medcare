import { RMA3_AGE_SCHEMES, ageBand, ageInCompletedYears } from "@/lib/reports/age-bands";
import { DAY, ageSexBreakdown, inRange, isPregnantAt, row, sexColumns, type ActivityTable, type Breakdown, type Person, type PregnancyPeriod } from "@/lib/reports/activity-rows";
import { malariaBreakdown } from "@/lib/reports/rma3-activity";
import { codeMatchesItems, parseIcd10Ranges } from "@/lib/diagnoses/icd10-ranges";
import { RMA3_ACT_INDICATORS } from "@/lib/reports/rma3-acts";

// RMA3 rows that cross a coded diagnosis with something else: its status (suspected), the
// referral of the stay, the treatment prescribed in the same stay, the patient's age, a
// positive malaria test; plus the acts linked to an RMA3 indicator. Pure, unit-tested in
// rma3-coded.test.ts. Counting conventions: activity-rows.ts.
//
// Definitions (to validate with the medical team):
//  - "référé" = the diagnosis was made in a stay that ended "transferred";
//  - "pris en charge" = a confirmed (not suspected) diagnosis in a stay not transferred;
//  - "traité par SRO / zinc / antibiotique" = an article tagged so (Pharmacy) prescribed in the
//    stay of the diagnosis;
//  - "paludisme confirmé" = B50-B53 (species identified), or B54 with a positive test (TDR /
//    microscopy) in the 30 days before the death;
//  - sick newborn = a coded consultation diagnosis, outside chapter Z, before 28 days of age.

const codes = (ranges: string) => {
  const parsed = parseIcd10Ranges(ranges);
  if (!parsed.ok) throw new Error(`invalid ICD-10 ranges: ${ranges}`);
  return (code: string) => codeMatchesItems(code, parsed.items);
};

const BREAST = codes("C50");
const CERVIX = codes("C53");
const FISTULA = codes("N82");
const PROSTATE = codes("C61");
const DIARRHOEA = codes("A00-A09");
const PNEUMONIA = codes("J12-J18");
const STI = codes("A50-A64");
const MENTAL = codes("F00-F99");
const ROAD_ACCIDENT = codes("V01-V89");
const MALARIA_CONFIRMED = codes("B50-B53");
const MALARIA_UNSPECIFIED = codes("B54");
const CHAPTER_Z = codes("Z00-Z99");

export type Rma3Treatment = "ors" | "zinc" | "antibiotic";

export interface CodedDiagnosis {
  patientId: string;
  stayId: string | null;
  context: "consultation" | "discharge" | "death";
  icd10Code: string;
  isNewCase: boolean;
  isSuspected: boolean;
  recordedAt: Date;
  // The stay of the diagnosis ended "transferred" (referral to a higher level).
  stayTransferred: boolean;
  patient: Person;
  pregnancies: PregnancyPeriod[];
}

export interface CodedAct {
  id: string;
  patientId: string;
  at: Date;
  indicator: string;
  patient: Person;
}

export interface Rma3CodedInput {
  start: Date;
  end: Date;
  diagnoses: CodedDiagnosis[]; // recorded this month
  // Treatments prescribed in each stay (articles tagged in the pharmacy).
  stayTreatments: Record<string, Rma3Treatment[]>;
  // Positive malaria tests (TDR / microscopy), from 30 days before the month.
  positiveMalariaTests: { patientId: string; at: Date }[];
  acts: CodedAct[]; // performed this month
}

type PersonEvent = { id: string; at: Date; person: Person };

export function buildCodedTables(input: Rma3CodedInput): ActivityTable[] {
  const inMonth = inRange(input.start, input.end);
  const month = input.diagnoses.filter((d) => inMonth(d.recordedAt));
  const ev = (d: CodedDiagnosis): PersonEvent => ({ id: d.patientId, at: d.recordedAt, person: d.patient });
  const clinical = month.filter((d) => d.context !== "death");
  const none: Breakdown<PersonEvent> = { columns: [], keyOf: () => "" };

  // ── II.2 cancers and fistulas ──
  const matching = (match: (code: string) => boolean) => clinical.filter((d) => match(d.icd10Code));
  const suspected = (match: (code: string) => boolean) => matching(match).filter((d) => d.isSuspected).map(ev);
  const managed = (match: (code: string) => boolean) => matching(match).filter((d) => !d.isSuspected && !d.stayTransferred).map(ev);
  const referred = (match: (code: string) => boolean) => matching(match).filter((d) => d.stayTransferred).map(ev);
  const actsOf = (indicator: string) => input.acts.filter((a) => a.indicator === indicator && inMonth(a.at));
  const cervicalScreening = actsOf("II.2-001").filter((a) => {
    const age = ageInCompletedYears(a.patient.birthDate, a.at);
    return a.patient.gender === "F" && age >= 30 && age <= 49;
  });

  const cancers: ActivityTable = {
    section: "II.2",
    title: "Cancers et fistules : dépistage, suspicion, prise en charge, référence",
    columns: [],
    rows: [
      row("II.2-001", "Femmes de 30-49 ans dépistées (cancer du col)", none, cervicalScreening.map((a) => ({ id: a.patientId, at: a.at, person: a.patient })), true),
      row("II.2-002", "Cas de cancer du sein suspectés", none, suspected(BREAST), true),
      row("II.2-004", "Cas de cancer du sein pris en charge", none, managed(BREAST), true),
      row("II.2-005", "Cas de cancer du sein référés", none, referred(BREAST), true),
      row("II.2-006", "Cas de cancer du col suspectés", none, suspected(CERVIX), true),
      row("II.2-008", "Cas de cancer du col pris en charge", none, managed(CERVIX), true),
      row("II.2-009", "Cas de cancer du col référés", none, referred(CERVIX), true),
      row("II.2-011", "Cas de fistules obstétricales pris en charge", none, managed(FISTULA), true),
      row("II.2-012", "Cas de fistules obstétricales référés", none, referred(FISTULA), true),
      row("II.2-014", "Cas de cancer de la prostate pris en charge", none, managed(PROSTATE), true),
      row("II.2-015", "Cas de cancer de la prostate référés", none, referred(PROSTATE), true),
    ],
    note: "Suspecté = diagnostic coché « suspecté » ; référé = diagnostic d'un séjour sorti « transféré » ; pris en charge = diagnostic confirmé d'un séjour non transféré. Dépistage du col = acte rattaché à II.2-001 (Paramètres > Actes médicaux).",
  };

  // ── III.7 PCIMNE treatments (children 0-59 months only) ──
  const child = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.child0to59m, false);
  const under5 = (d: CodedDiagnosis) => child.keyOf(ev(d)) !== "";
  const treatedWith = (d: CodedDiagnosis, ...tags: Rma3Treatment[]) => Boolean(d.stayId) && tags.every((t) => (input.stayTreatments[d.stayId!] ?? []).includes(t));
  const childDx = clinical.filter((d) => !d.isSuspected && under5(d));
  const pcimne: ActivityTable = {
    section: "III.7",
    title: "PCIMNE : traitements",
    columns: child.columns,
    rows: [
      row("III.7-002", "Enfants ayant reçu le SRO contre la diarrhée", child, childDx.filter((d) => DIARRHOEA(d.icd10Code) && treatedWith(d, "ors")).map(ev), true),
      row("III.7-003", "Enfants ayant reçu SRO + zinc", child, childDx.filter((d) => DIARRHOEA(d.icd10Code) && treatedWith(d, "ors", "zinc")).map(ev), true),
      row("III.7-005", "Enfants atteints de pneumonie traités par antibiotique", child, childDx.filter((d) => PNEUMONIA(d.icd10Code) && treatedWith(d, "antibiotic")).map(ev), true),
    ],
    note: "Traitement = article marqué SRO / zinc / antibiotique (Pharmacie > Inventaire) prescrit dans le séjour du diagnostic.",
  };

  // ── III.8 adolescents received for an STI (10-24 years) ──
  const adolescent = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.adolescent, true);
  const adolescentSti = clinical.filter(
    (d) => d.context === "consultation" && !d.isSuspected && STI(d.icd10Code) && ageBand(RMA3_AGE_SCHEMES.adolescent, d.patient.birthDate, d.recordedAt) !== null
  );
  const adolescents: ActivityTable = {
    section: "III.8",
    title: "Santé des adolescents : IST",
    columns: adolescent.columns,
    rows: [row("III.8-001", "Adolescents (10-24 ans) reçus en FOSA pour IST", adolescent, adolescentSti.map(ev), true)],
  };

  // ── II.1.4 sick newborns ──
  const sickNewborns = clinical.filter(
    (d) => d.context === "consultation" && !CHAPTER_Z(d.icd10Code) && d.recordedAt.getTime() - d.patient.birthDate.getTime() < 28 * DAY
  );
  const babies: Breakdown<{ id: string; at: Date; sex: string | null }> = { columns: sexColumns, keyOf: (e) => (e.sex === "M" || e.sex === "F" ? e.sex : "") };
  const newborns: ActivityTable = {
    section: "II.1.4",
    title: "Nouveau-nés malades",
    columns: sexColumns,
    rows: [
      row(
        "II.1.4-012",
        "Nouveaux cas de nouveau-nés malades reçus (moins de 28 jours)",
        babies,
        sickNewborns.map((d) => ({ id: d.patientId, at: d.recordedAt, sex: d.patient.gender })),
        true
      ),
    ],
    note: "Nouveau-né malade = diagnostic codé à la consultation (hors chapitre Z) avant 28 jours de vie.",
  };

  // ── IV.2.4-5 deaths from confirmed malaria ──
  type MalariaEv = PersonEvent & { pregnant: boolean };
  const malariaCols = malariaBreakdown<MalariaEv>();
  const confirmedMalariaDeaths = month.filter(
    (d) =>
      d.context === "death" &&
      (MALARIA_CONFIRMED(d.icd10Code) ||
        (MALARIA_UNSPECIFIED(d.icd10Code) &&
          input.positiveMalariaTests.some((t) => t.patientId === d.patientId && t.at <= d.recordedAt && d.recordedAt.getTime() - t.at.getTime() <= 30 * DAY)))
  );
  const malaria: ActivityTable = {
    section: "IV.2.4-5",
    title: "Décès par paludisme confirmé",
    columns: malariaCols.columns,
    rows: [
      row("IV.2.4-5-020", "Décès par paludisme confirmé", malariaCols, confirmedMalariaDeaths.map((d) => ({ ...ev(d), pregnant: isPregnantAt(d.pregnancies, d.recordedAt) })), true),
    ],
    note: "Paludisme confirmé = cause de décès B50-B53, ou B54 avec un test positif (TDR / microscopie) dans les 30 jours précédant le décès.",
  };

  // ── V.1 road traffic accidents ──
  const cause = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.cause, false);
  const accidents: ActivityTable = {
    section: "V.1",
    title: "Accidents de la voie publique",
    columns: cause.columns,
    rows: [
      row("V.1-005", "Accidentés de la voie publique reçus", cause, clinical.filter((d) => ROAD_ACCIDENT(d.icd10Code)).map(ev), true),
      row("V.1-009", "Décès d'accidentés de la voie publique", cause, month.filter((d) => d.context === "death" && ROAD_ACCIDENT(d.icd10Code)).map(ev), true),
    ],
    note: "Cause externe codée V01-V89 (souvent en diagnostic secondaire, en plus de la lésion).",
  };

  // ── IV.4.9 mental health referrals ──
  const mental = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.mentalHealth, true);
  const mentalReferrals: ActivityTable = {
    section: "IV.4.9",
    title: "Santé mentale : cas référés",
    columns: mental.columns,
    rows: [row("IV.4.9-013", "Cas de santé mentale référés", mental, clinical.filter((d) => MENTAL(d.icd10Code) && d.stayTransferred).map(ev), true)],
  };

  // ── Acts (IV.4.10, IV.4.11) ──
  const eye = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.eyeOral, false);
  const oral = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.eyeOral, true);
  const actEv = (a: CodedAct): PersonEvent => ({ id: a.id, at: a.at, person: a.patient });
  const actRow = (indicator: string, breakdown: Breakdown<PersonEvent>) =>
    row(indicator, RMA3_ACT_INDICATORS.find((i) => i.code === indicator)!.label, breakdown, actsOf(indicator).map(actEv), false);
  const eyeActs: ActivityTable = { section: "IV.4.10", title: "Troubles visuels : actes", columns: eye.columns, rows: [actRow("IV.4.10-003", eye)] };
  const oralActs: ActivityTable = {
    section: "IV.4.11",
    title: "Affections bucco-dentaires : actes",
    columns: oral.columns,
    rows: ["IV.4.11-011", "IV.4.11-012", "IV.4.11-013", "IV.4.11-014", "IV.4.11-015"].map((code) => actRow(code, oral)),
    note: "Actes rattachés à l'indicateur dans Paramètres > Actes médicaux : acte choisi à l'admission ou intervention chirurgicale terminée portant ce code.",
  };

  return [cancers, pcimne, adolescents, newborns, malaria, accidents, mentalReferrals, eyeActs, oralActs];
}
