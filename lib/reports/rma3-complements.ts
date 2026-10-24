import { RMA3_AGE_SCHEMES, ageBand } from "@/lib/reports/age-bands";
import { ageSexBreakdown, inRange, row, type ActivityTable, type Breakdown, type Person } from "@/lib/reports/activity-rows";
import { tbBreakdown, type TbClassification } from "@/lib/reports/rma3-activity";

// Last RMA3 complements: active TB case finding and TB case complements (IV.3), care per the
// national protocol (III.7-006, III.8-002), iron / folic acid for adolescent girls (III.8-003),
// chronic care (IV.4.1, IV.4.4), civil registration (V.2), pharmacovigilance (V.8). Pure,
// unit-tested in rma3-complements.test.ts.
//
// Definitions (to validate):
//  - diabetes active file = enrolments open at the end of the month;
//  - hypertension controlled = last visit of the month below 140 / 90 mmHg;
//  - iron / folic acid = an article tagged so, prescribed to a girl of 10-24 years.

type PersonEvent = { id: string; at: Date; person: Person };
const none = <E extends { id: string; at: Date }>(): Breakdown<E> => ({ columns: [], keyOf: () => "" });

export interface CmpTbScreening {
  id: string;
  patientId: string;
  screenedAt: Date;
  presumptive: boolean;
  sentToLabAt: Date | null;
  testedAt: Date | null;
  tptStartedAt: Date | null;
  patient: Person;
}

export interface CmpTbCase {
  id: string;
  notificationDate: Date;
  classification: TbClassification;
  rifampicinResistant: boolean;
  cotrimoxazole: boolean;
  isHealthWorker: boolean;
  secondLineStartedAt: Date | null;
  patient: Person;
}

export interface CmpConsultation {
  patientId: string;
  at: Date;
  followedNationalProtocol: boolean;
  stiDiagnosis: boolean;
  patient: Person;
}

export interface CmpChronicEnrolment {
  id: string;
  condition: "diabetes" | "hypertension";
  enrolledAt: Date;
  exitedAt: Date | null;
  patient: Person;
  visits: {
    visitDate: Date;
    onTreatment: boolean;
    systolic: number | null;
    diastolic: number | null;
    hba1c: number | null;
    educationIndividual: boolean;
    educationGroup: boolean;
  }[];
}

export interface CmpReaction {
  id: string;
  reportedAt: Date;
  serious: boolean;
  investigatedAt: Date | null;
  drugName: string;
  lotNumber: string | null;
  expiryDate: Date | null;
}

export interface Rma3ComplementsInput {
  start: Date;
  end: Date;
  tbScreenings: CmpTbScreening[]; // screened or followed up this month
  tbCases: CmpTbCase[]; // notified or put on second line this month
  consultations: CmpConsultation[]; // completed consultations of the month
  ironPrescriptions: { patientId: string; at: Date; patient: Person }[]; // this month
  chronicEnrolments: CmpChronicEnrolment[]; // open at some point of the month
  declarations: { type: "birth" | "death"; transmittedAt: Date }[]; // this month
  reactions: CmpReaction[]; // reported or investigated this month
}

export function buildComplementTables(input: Rma3ComplementsInput): ActivityTable[] {
  const inMonth = inRange(input.start, input.end);

  // ── IV.3 active case finding (age bands) ──
  const tbAge = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.tuberculosis, false);
  const scr = (s: CmpTbScreening, at: Date): PersonEvent => ({ id: s.patientId, at, person: s.patient });
  const screened = input.tbScreenings.filter((s) => inMonth(s.screenedAt));
  const screening: ActivityTable = {
    section: "IV.3",
    title: "Tuberculose : recherche active et traitement préventif",
    columns: tbAge.columns,
    rows: [
      row("IV.3-001", "Personnes chez qui la TB a été recherchée", tbAge, screened.map((s) => scr(s, s.screenedAt)), true),
      row("IV.3-002", "Cas présumés de TB parmi les personnes recherchées", tbAge, screened.filter((s) => s.presumptive).map((s) => scr(s, s.screenedAt)), true),
      row("IV.3-003", "Cas présumés envoyés au laboratoire", tbAge, input.tbScreenings.filter((s) => inMonth(s.sentToLabAt)).map((s) => scr(s, s.sentToLabAt!)), true),
      row("IV.3-004", "Cas présumés testés au laboratoire", tbAge, input.tbScreenings.filter((s) => inMonth(s.testedAt)).map((s) => scr(s, s.testedAt!)), true),
      row("IV.3-005", "Personnes mises sous traitement préventif de la TB", tbAge, input.tbScreenings.filter((s) => inMonth(s.tptStartedAt)).map((s) => scr(s, s.tptStartedAt!)), true),
    ],
    note: "Registre de dépistage TB (Programmes de santé > Tuberculose) ; chaque étape comptée le mois où elle a lieu.",
  };

  // ── IV.3 TB case complements (age × form) ──
  type TbEv = PersonEvent & { classification: TbClassification };
  const tbCols = tbBreakdown<TbEv>();
  const notified = input.tbCases.filter((c) => inMonth(c.notificationDate));
  const tbEv = (c: CmpTbCase, at = c.notificationDate): TbEv => ({ id: c.id, at, person: c.patient, classification: c.classification });
  const tbComplements: ActivityTable = {
    section: "IV.3",
    title: "Tuberculose : TB-RR, 2e ligne, cotrimoxazole, personnel de santé",
    columns: tbCols.columns,
    rows: [
      row("IV.3-010", "Patients TB-RR (résistants à la rifampicine)", tbCols, notified.filter((c) => c.rifampicinResistant).map((c) => tbEv(c)), false),
      row("IV.3-023", "Patients TB-RR mis sous traitement de 2e ligne", tbCols, input.tbCases.filter((c) => inMonth(c.secondLineStartedAt)).map((c) => tbEv(c, c.secondLineStartedAt!)), false),
      row("IV.3-014", "Patients TB sous cotrimoxazole", tbCols, notified.filter((c) => c.cotrimoxazole).map((c) => tbEv(c)), false),
      row("IV.3-015", "Personnels de santé diagnostiqués TB", tbCols, notified.filter((c) => c.isHealthWorker).map((c) => tbEv(c)), false),
    ],
  };

  // ── III.7-006, III.8-002/003 ──
  const consultations = input.consultations.filter((c) => inMonth(c.at) && c.followedNationalProtocol);
  const consultEv = (c: CmpConsultation): PersonEvent => ({ id: c.patientId, at: c.at, person: c.patient });
  const child = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.child0to59m, false);
  const adolescent = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.adolescent, true);
  const isChild = (c: CmpConsultation) => ageBand(RMA3_AGE_SCHEMES.child0to59m, c.patient.birthDate, c.at) !== null;
  const isAdolescent = (p: Person, at: Date) => ageBand(RMA3_AGE_SCHEMES.adolescent, p.birthDate, at) !== null;
  const protocol: ActivityTable = {
    section: "III.7",
    title: "PCIMNE : enfants pris en charge selon l'approche",
    columns: child.columns,
    rows: [row("III.7-006", "Enfants de 0-59 mois pris en charge selon l'approche PCIMNE", child, consultations.filter(isChild).map(consultEv), true)],
    note: "Consultation signée avec la case « prise en charge selon le protocole national ».",
  };
  const adolescents: ActivityTable = {
    section: "III.8",
    title: "Santé des adolescents : IST selon les normes, fer / acide folique",
    columns: adolescent.columns,
    rows: [
      row("III.8-002", "Adolescents (10-24 ans) avec IST pris en charge selon les normes", adolescent, consultations.filter((c) => c.stiDiagnosis && isAdolescent(c.patient, c.at)).map(consultEv), true),
      row(
        "III.8-003",
        "Adolescentes supplémentées en fer / acide folique en FOSA",
        adolescent,
        input.ironPrescriptions.filter((p) => inMonth(p.at) && p.patient.gender === "F" && isAdolescent(p.patient, p.at)).map((p) => ({ id: p.patientId, at: p.at, person: p.patient })),
        true
      ),
    ],
  };

  // ── IV.4.1 diabetes, IV.4.4 hypertension ──
  const open = (e: CmpChronicEnrolment, at: Date) => e.enrolledAt < at && (e.exitedAt === null || e.exitedAt >= at);
  const monthVisits = (e: CmpChronicEnrolment) => e.visits.filter((v) => inMonth(v.visitDate));
  const diabetes = input.chronicEnrolments.filter((e) => e.condition === "diabetes");
  const hypertension = input.chronicEnrolments.filter((e) => e.condition === "hypertension");
  const dCols = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.diabetes, true);
  const hCols = ageSexBreakdown<PersonEvent>(RMA3_AGE_SCHEMES.hypertension, true);
  const endEv = (e: CmpChronicEnrolment): PersonEvent => ({ id: e.id, at: new Date(input.end.getTime() - 1), person: e.patient });
  const visitEvents = (list: CmpChronicEnrolment[], filter: (v: CmpChronicEnrolment["visits"][number]) => boolean) =>
    list.flatMap((e) => monthVisits(e).filter(filter).map((v, i) => ({ id: `${e.id}:${v.visitDate.getTime()}:${i}`, at: v.visitDate, person: e.patient })));
  const lastVisit = (e: CmpChronicEnrolment) => [...monthVisits(e)].sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime())[0];
  const chronicDiabetes: ActivityTable = {
    section: "IV.4.1",
    title: "Diabète : file active, sorties, éducation thérapeutique, HbA1c",
    columns: dCols.columns,
    rows: [
      row("IV.4.1-005", "File active du mois (diabétiques suivis)", dCols, diabetes.filter((e) => open(e, input.end)).map(endEv), true),
      row("IV.4.1-006", "Sortis du programme", dCols, diabetes.filter((e) => inMonth(e.exitedAt)).map((e) => ({ id: e.id, at: e.exitedAt!, person: e.patient })), true),
      row("IV.4.1-007", "Séances d'éducation thérapeutique individuelles", dCols, visitEvents(diabetes, (v) => v.educationIndividual), false),
      row("IV.4.1-008", "Séances d'éducation thérapeutique de groupe", dCols, visitEvents(diabetes, (v) => v.educationGroup), false),
      row("IV.4.1-009", "Hémoglobines glyquées > 7 %", dCols, visitEvents(diabetes, (v) => v.hba1c !== null && v.hba1c > 7), false),
    ],
    note: "Registre des maladies chroniques (Programmes de santé). File active = inscrits non sortis à la fin du mois.",
  };
  const chronicHta: ActivityTable = {
    section: "IV.4.4",
    title: "Hypertension : personnes sous traitement et contrôlées",
    columns: hCols.columns,
    rows: [
      row("IV.4.4-003", "Personnes sous traitement antihypertenseur", hCols, hypertension.filter((e) => monthVisits(e).some((v) => v.onTreatment)).map((e) => ({ id: e.id, at: lastVisit(e)!.visitDate, person: e.patient })), true),
      row(
        "IV.4.4-004",
        "Personnes hypertendues contrôlées (< 140 / 90 mmHg)",
        hCols,
        hypertension
          .filter((e) => {
            const v = lastVisit(e);
            return v && v.systolic !== null && v.diastolic !== null && v.systolic < 140 && v.diastolic < 90;
          })
          .map((e) => ({ id: e.id, at: lastVisit(e)!.visitDate, person: e.patient })),
        true
      ),
    ],
  };

  // ── V.2 civil registration ──
  const declared = input.declarations.filter((d) => inMonth(d.transmittedAt));
  const civil: ActivityTable = {
    section: "V.2",
    title: "État civil",
    columns: [],
    rows: [
      { code: "V.2-001", label: "Déclarations de naissances transmises au centre d'état civil", cells: {}, total: declared.filter((d) => d.type === "birth").length },
      { code: "V.2-002", label: "Déclarations de décès transmises au centre d'état civil", cells: {}, total: declared.filter((d) => d.type === "death").length },
    ],
  };

  // ── V.8 pharmacovigilance ──
  const reported = input.reactions.filter((r) => inMonth(r.reportedAt));
  const ev = (r: CmpReaction, at: Date) => ({ id: r.id, at });
  const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
  const pharmacovigilance: ActivityTable = {
    section: "V.8",
    title: "Pharmacovigilance",
    columns: [],
    rows: [
      row("V.8-001", "Total des événements indésirables notifiés", none(), reported.map((r) => ev(r, r.reportedAt)), false),
      row("V.8-002", "Total des événements indésirables graves notifiés", none(), reported.filter((r) => r.serious).map((r) => ev(r, r.reportedAt)), false),
      row("V.8-003", "Total des événements graves investigués", none(), input.reactions.filter((r) => r.serious && inMonth(r.investigatedAt)).map((r) => ev(r, r.investigatedAt!)), false),
      // The form asks for the drug, lot and expiry of each event.
      ...reported.map((r, i) => ({
        code: `V.8-detail/${i + 1}`,
        label: `${r.drugName} · lot ${r.lotNumber ?? "—"} · péremption ${date(r.expiryDate)}${r.serious ? " · grave" : ""}`,
        cells: {},
        total: 1,
      })),
    ],
  };

  return [screening, tbComplements, protocol, adolescents, chronicDiabetes, chronicHta, civil, pharmacovigilance];
}
