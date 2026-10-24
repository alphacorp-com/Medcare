import { RMA3_AGE_SCHEMES, ageInCompletedMonths, type DisaggregationColumn } from "@/lib/reports/age-bands";
import { DAY, ageSexBreakdown, inRange, isPregnantAt, row, type ActivityRow, type ActivityTable, type Breakdown, type Person, type PregnancyPeriod } from "@/lib/reports/activity-rows";
import { malariaBreakdown } from "@/lib/reports/rma3-activity";
import { INJECTABLE_TREATMENTS } from "@/lib/programs/input";
import { STAFF_CADRES } from "@/lib/hr/cadres";

// RMA3 tables of the malaria complements (IV.2.2-3, IV.2.4-5), oxygen (V.9), acute
// malnutrition (IV.6), infant feeding (III.9), blood bank (V.6) and human resources (VI.5).
// Pure, unit-tested in rma3-programs.test.ts. Counting conventions: activity-rows.ts.
//
// Definitions (to validate with the programmes):
//  - hypoxaemia = SpO2 < 90 %; newborn < 28 days, child < 5 years, post-partum = within 42
//    days after the end of a pregnancy;
//  - PCIMA columns = age at admission; "en charge" = admitted and not discharged at the date;
//  - "donneur fidélisé" = voluntary donor who had already given blood before this donation;
//  - staff counted at the end of the month; retired = retirement date passed.

const none = <E extends { id: string; at: Date }>(): Breakdown<E> => ({ columns: [], keyOf: () => "" });

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface ProgramMalariaCase {
  id: string;
  diagnosedAt: Date;
  testType: string;
  result: string;
  severity: string | null;
  species: string | null;
  treatment: string | null;
  treatedWithAct: boolean;
  hospitalized: boolean;
  freeOfCharge: boolean;
  isPregnantAtDiagnosis: boolean;
  patient: Person;
}

export interface ProgramEquipment {
  type: string;
  status: string;
}

export interface ProgramEpisode {
  id: string;
  patientId: string;
  detectedAt: Date;
  spo2: number | null;
  respiratoryDistress: boolean;
  deliveryRoom: boolean;
  oxygenGiven: boolean;
  outcome: string | null;
  outcomeAt: Date | null;
  patient: Person;
  pregnancies: PregnancyPeriod[];
}

export interface ProgramNutritionCase {
  id: string;
  program: "cna" | "cnti";
  admittedAt: Date;
  admissionType: string;
  residency: string;
  hivTested: boolean;
  anjeCounseling: boolean;
  exitedAt: Date | null;
  exitReason: string | null;
  patient: Person;
}

export interface ProgramGrowthVisit {
  patientId: string;
  visitDate: Date;
  weightKg: number | null;
  receivesWater: boolean | null;
  complementaryFood: boolean | null;
  stillBreastfed: boolean | null;
  multivitaminGiven: boolean;
  patient: Person;
}

export interface ProgramDonation {
  id: string;
  donorId: string;
  donorType: "voluntary" | "family";
  // Donations of the same donor before this one (any time).
  previousDonations: number;
  sessionId: string | null;
  collectedAt: Date;
  hivResult: string;
  hbvResult: string;
  hcvResult: string;
  syphilisResult: string;
  servedAt: Date | null;
  transfusedAt: Date | null;
  destroyedAt: Date | null;
}

export interface ProgramStaff {
  cadre: string;
  sex: string;
  payer: "state" | "local";
  inPost: boolean;
  hiredAt: Date | null;
  retirementDate: Date | null;
  leftAt: Date | null;
}

export interface Rma3ProgramsInput {
  start: Date;
  end: Date;
  malariaCases: ProgramMalariaCase[]; // diagnosed this month
  itnVisits: { patientId: string; visitDate: Date }[]; // antenatal visits with an ITN, this month
  equipment: ProgramEquipment[]; // current park
  episodes: ProgramEpisode[]; // detected or closed this month
  nutritionCases: ProgramNutritionCase[]; // open at some point of the month
  growthVisits: ProgramGrowthVisit[]; // this month
  donations: ProgramDonation[]; // collected, served, transfused or destroyed this month
  mobileSessions: { id: string; heldAt: Date }[]; // this month
  // HIV-positive donors (patient file) who started ART this month.
  donorsStartedOnArt: number;
  staff: ProgramStaff[];
}

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildProgramTables(input: Rma3ProgramsInput): ActivityTable[] {
  return [
    ...malariaTables(input),
    oxygenTable(input),
    ...nutritionTables(input),
    growthTable(input),
    bloodTable(input),
    staffTable(input),
  ];
}

function malariaTables(input: Rma3ProgramsInput): ActivityTable[] {
  const inMonth = inRange(input.start, input.end);
  type MalariaEv = { id: string; at: Date; person: Person; pregnant: boolean };
  const cols = malariaBreakdown<MalariaEv>();
  const cases = input.malariaCases.filter((c) => inMonth(c.diagnosedAt));
  const ev = (c: ProgramMalariaCase): MalariaEv => ({ id: c.id, at: c.diagnosedAt, person: c.patient, pregnant: c.isPregnantAtDiagnosis });
  const positive = (c: ProgramMalariaCase) => c.result === "positive" && c.testType !== "clinical_only";
  const severe = (c: ProgramMalariaCase) => c.severity === "severe";
  const simple = (c: ProgramMalariaCase) => !severe(c);
  const notConfirmed = (c: ProgramMalariaCase) => c.testType === "clinical_only" || c.result !== "positive";
  const gotAntimalarial = (c: ProgramMalariaCase) => c.treatment !== null || c.treatedWithAct;
  const r = (code: string, label: string, filter: (c: ProgramMalariaCase) => boolean) => row(code, label, cols, cases.filter(filter).map(ev), false);
  const rdt = (c: ProgramMalariaCase) => c.testType === "rdt" && positive(c);
  const micro = (c: ProgramMalariaCase) => c.testType === "microscopy" && positive(c);

  const morbidity: ActivityTable = {
    section: "IV.2.4-5",
    title: "Paludisme : espèces, traitements, hospitalisations, gratuité",
    columns: cols.columns,
    rows: [
      r("IV.2.4-5-022", "Hospitalisés pour suspicion de paludisme grave", (c) => severe(c) && c.hospitalized),
      r("IV.2.4-5-007", "Hospitalisations pour paludisme grave confirmé", (c) => severe(c) && positive(c) && c.hospitalized),
      r("IV.2.4-5-037", "Hospitalisations grave confirmé par TDR", (c) => severe(c) && rdt(c) && c.hospitalized),
      r("IV.2.4-5-038", "Hospitalisations grave confirmé par microscopie", (c) => severe(c) && micro(c) && c.hospitalized),
      r("IV.2.4-5-026", "TDR positifs (P. falciparum seul)", (c) => rdt(c) && c.species === "falciparum"),
      r("IV.2.4-5-027", "TDR positifs (P. falciparum + autres)", (c) => rdt(c) && c.species === "mixed"),
      r("IV.2.4-5-028", "TDR positifs (autres espèces)", (c) => rdt(c) && ["vivax", "malariae", "ovale", "other"].includes(c.species ?? "")),
      r("IV.2.4-5-030", "Microscopies positives P. falciparum", (c) => micro(c) && c.species === "falciparum"),
      r("IV.2.4-5-031", "Microscopies positives P. vivax", (c) => micro(c) && c.species === "vivax"),
      r("IV.2.4-5-032", "Microscopies positives P. malariae", (c) => micro(c) && c.species === "malariae"),
      r("IV.2.4-5-033", "Microscopies positives P. ovale", (c) => micro(c) && c.species === "ovale"),
      r("IV.2.4-5-034", "Microscopies positives (infections multiples)", (c) => micro(c) && c.species === "mixed"),
      r("IV.2.4-5-039", "Simples confirmés traités par ASAQ", (c) => simple(c) && positive(c) && c.treatment === "asaq"),
      r("IV.2.4-5-040", "Simples confirmés traités par AL", (c) => simple(c) && positive(c) && c.treatment === "al"),
      r("IV.2.4-5-041", "Simples confirmés traités par DHAP", (c) => simple(c) && positive(c) && c.treatment === "dhap"),
      r("IV.2.4-5-042", "Simples confirmés traités par d'autres ACT", (c) => simple(c) && positive(c) && c.treatment === "other_act"),
      r("IV.2.4-5-043", "Simples confirmés traités par quinine comprimés", (c) => simple(c) && positive(c) && c.treatment === "quinine_oral"),
      r("IV.2.4-5-008", "Graves confirmés traités par injectables", (c) => severe(c) && positive(c) && INJECTABLE_TREATMENTS.has(c.treatment ?? "")),
      r("IV.2.4-5-044", "Graves confirmés traités par artésunate injectable", (c) => severe(c) && positive(c) && c.treatment === "artesunate_inj"),
      r("IV.2.4-5-045", "Graves confirmés traités par artéméther injectable", (c) => severe(c) && positive(c) && c.treatment === "artemether_inj"),
      r("IV.2.4-5-046", "Graves confirmés traités par quinine injectable", (c) => severe(c) && positive(c) && c.treatment === "quinine_inj"),
      r("IV.2.4-5-009", "Paludisme simple confirmé traité gratuitement", (c) => simple(c) && positive(c) && c.freeOfCharge),
      r("IV.2.4-5-010", "Paludisme grave confirmé traité gratuitement", (c) => severe(c) && positive(c) && c.freeOfCharge),
      r("IV.2.4-5-047", "Suspects simples non testés / négatifs ayant reçu un antipaludique", (c) => simple(c) && notConfirmed(c) && gotAntimalarial(c)),
      r("IV.2.4-5-048", "Hospitalisés pour suspicion grave non testés / négatifs ayant reçu un antipaludique", (c) => severe(c) && c.hospitalized && notConfirmed(c) && gotAntimalarial(c)),
    ],
    note: "Espèce et molécule choisies dans les listes du cas de paludisme ; ACT = ASAQ, AL, DHAP ou autre ACT (aussi la case « traité par ACT »).",
  };
  const itn: ActivityTable = {
    section: "IV.2.2-3",
    title: "MILDA",
    columns: [],
    rows: [row("IV.2.2-3-001", "MILDA distribuées en routine aux femmes enceintes (CPN)", none(), input.itnVisits.filter((v) => inMonth(v.visitDate)).map((v) => ({ id: `${v.patientId}:${v.visitDate.getTime()}`, at: v.visitDate })), false)],
  };

  return [itn, morbidity];
}

function oxygenTable(input: Rma3ProgramsInput): ActivityTable {
  const inMonth = inRange(input.start, input.end);
  const count = (type: string, functionalOnly: boolean) => input.equipment.filter((e) => e.type === type && e.status !== "retired" && (!functionalOnly || e.status === "functional")).length;
  const fixed = (code: string, label: string, value: number): ActivityRow => ({ code, label, cells: {}, total: value });

  type Ev = { id: string; at: Date };
  const detected = input.episodes.filter((e) => inMonth(e.detectedAt));
  const closed = input.episodes.filter((e) => inMonth(e.outcomeAt));
  const hypoxemic = (e: ProgramEpisode) => e.spo2 !== null && e.spo2 < 90;
  const ageDays = (e: ProgramEpisode, at: Date) => (at.getTime() - e.patient.birthDate.getTime()) / DAY;
  const newborn = (e: ProgramEpisode, at = e.detectedAt) => ageDays(e, at) < 28;
  const child = (e: ProgramEpisode, at = e.detectedAt) => !newborn(e, at) && ageInCompletedMonths(e.patient.birthDate, at) < 60;
  const pregnant = (e: ProgramEpisode, at = e.detectedAt) => isPregnantAt(e.pregnancies, at);
  const postpartum = (e: ProgramEpisode, at = e.detectedAt) => !pregnant(e, at) && e.pregnancies.some((p) => p.endedAt <= at && at.getTime() - p.endedAt.getTime() <= 42 * DAY);
  const ev = (e: ProgramEpisode): Ev => ({ id: e.id, at: e.detectedAt });
  const evOut = (e: ProgramEpisode): Ev => ({ id: e.id, at: e.outcomeAt! });
  const d = (code: string, label: string, filter: (e: ProgramEpisode) => boolean) => row(code, label, none<Ev>(), detected.filter(filter).map(ev), false);
  const o = (code: string, label: string, filter: (e: ProgramEpisode) => boolean) => row(code, label, none<Ev>(), closed.filter(filter).map(evOut), false);
  const died = (e: ProgramEpisode) => e.outcome === "died";

  return {
    section: "V.9",
    title: "Oxygène : équipements et prise en charge de l'hypoxémie",
    columns: [] as DisaggregationColumn[],
    rows: [
      fixed("V.9-006", "Oxymètres de pouls disponibles", count("pulse_oximeter", false)),
      fixed("V.9-007", "Oxymètres de pouls fonctionnels", count("pulse_oximeter", true)),
      fixed("V.9-008", "Concentrateurs d'oxygène disponibles", count("oxygen_concentrator", false)),
      fixed("V.9-009", "Concentrateurs d'oxygène fonctionnels", count("oxygen_concentrator", true)),
      fixed("V.9-010", "Respirateurs fonctionnels", count("ventilator", true)),
      fixed("V.9-011", "Bouteilles d'oxygène de 7 500 L", count("oxygen_cylinder_7500", false)),
      d("V.9-013", "Cas d'hypoxémie diagnostiqués", hypoxemic),
      d("V.9-014", "Nouveau-nés avec hypoxémie", (e) => hypoxemic(e) && newborn(e)),
      d("V.9-015", "Enfants en détresse respiratoire à l'admission", (e) => e.respiratoryDistress && child(e)),
      d("V.9-016", "Femmes enceintes avec hypoxémie en salle d'accouchement", (e) => hypoxemic(e) && e.deliveryRoom && pregnant(e)),
      d("V.9-017", "Femmes enceintes en détresse respiratoire", (e) => e.respiratoryDistress && pregnant(e)),
      d("V.9-018", "Femmes en post-partum avec hypoxémie", (e) => hypoxemic(e) && postpartum(e)),
      d("V.9-019", "Cas d'hypoxémie traités (oxygène)", (e) => hypoxemic(e) && e.oxygenGiven),
      d("V.9-020", "Nouveau-nés pris en charge par oxygène", (e) => newborn(e) && e.oxygenGiven),
      d("V.9-021", "Enfants ayant reçu de l'oxygène", (e) => child(e) && e.oxygenGiven),
      d("V.9-022", "Femmes enceintes en détresse respiratoire prises en charge par oxygène", (e) => e.respiratoryDistress && pregnant(e) && e.oxygenGiven),
      d("V.9-023", "Femmes en post-partum avec hypoxémie prises en charge par oxygène", (e) => hypoxemic(e) && postpartum(e) && e.oxygenGiven),
      o("V.9-024", "Cas d'hypoxémie référés", (e) => e.outcome === "referred"),
      o("V.9-025", "Cas d'hypoxémie sortis contre avis médical", (e) => e.outcome === "left_against_advice"),
      o("V.9-026", "Cas d'hypoxémie guéris", (e) => e.outcome === "cured"),
      o("V.9-027", "Cas d'hypoxémie décédés", died),
      o("V.9-028", "Décès de nouveau-nés hypoxémiques", (e) => died(e) && newborn(e, e.outcomeAt!)),
      o("V.9-029", "Décès d'enfants hypoxémiques", (e) => died(e) && child(e, e.outcomeAt!)),
      o("V.9-030", "Décès de femmes enceintes hypoxémiques", (e) => died(e) && pregnant(e, e.outcomeAt!)),
    ],
    note: "Équipements : état actuel du parc (Programmes de santé > Oxygène). Hypoxémie = SpO2 < 90 % ; nouveau-né < 28 jours, enfant < 5 ans, post-partum = 42 jours. Le stock d'oxygène figure dans le tableau des stocks (V.9).",
  };
}

const NUTRITION_PROGRAM_LABELS = { cna: "CNA (ambulatoire)", cnti: "CNTI (hospitalier)" } as const;

function nutritionTables(input: Rma3ProgramsInput): ActivityTable[] {
  const { start, end } = input;
  const inMonth = inRange(start, end);
  const cols = ageSexBreakdown<{ id: string; at: Date; person: Person }>(RMA3_AGE_SCHEMES.nutrition, false);
  return (["cna", "cnti"] as const).map((program) => {
    const cases = input.nutritionCases.filter((c) => c.program === program);
    const ev = (c: ProgramNutritionCase) => ({ id: c.id, at: c.admittedAt, person: c.patient });
    const openAt = (c: ProgramNutritionCase, at: Date) => c.admittedAt < at && (c.exitedAt === null || c.exitedAt >= at);
    const admitted = cases.filter((c) => inMonth(c.admittedAt));
    const newAdmissions = admitted.filter((c) => c.admissionType === "new_case" || c.admissionType === "relapse");
    const readmissions = admitted.filter((c) => c.admissionType === "readmission_after_default");
    const transfersIn = admitted.filter((c) => c.admissionType === "transfer_in");
    const exited = cases.filter((c) => inMonth(c.exitedAt));
    const exitedFor = (...reasons: string[]) => exited.filter((c) => reasons.includes(c.exitReason ?? ""));
    const r = (code: string, label: string, list: ProgramNutritionCase[]) => row(code, label, cols, list.map(ev), false);
    const totalNew = [...newAdmissions, ...readmissions];
    return {
      section: "IV.6",
      title: `PCIMA : ${NUTRITION_PROGRAM_LABELS[program]}`,
      columns: cols.columns,
      rows: [
        r("IV.6-001", "En charge au début du mois", cases.filter((c) => openAt(c, start))),
        r("IV.6-002", "Nouvelles admissions (P/T < -3 z, PB, œdèmes, rechute)", newAdmissions),
        r("IV.6-003", "Réadmissions après abandon", readmissions),
        r("IV.6-004", "Transferts internes reçus", transfersIn),
        r("IV.6-005", "Total nouvelles admissions", totalNew),
        r("IV.6-006", "Total admissions", admitted),
        r("IV.6-007", "Guéris", exitedFor("cured")),
        r("IV.6-008", "Abandons", exitedFor("defaulted")),
        r("IV.6-009", "Décès", exitedFor("died")),
        r("IV.6-010", "Non-répondants", exitedFor("non_responder")),
        r("IV.6-011", "Total décharges", exitedFor("cured", "defaulted", "died", "non_responder")),
        r("IV.6-012", "Transferts internes (sortie)", exitedFor("transfer_out")),
        r("IV.6-013", "Total sorties", exited),
        r("IV.6-014", "En charge à la fin du mois", cases.filter((c) => openAt(c, end))),
        r("IV.6-015/resident", "Nouvelles admissions : résidents", totalNew.filter((c) => c.residency === "resident")),
        r("IV.6-015/displaced", "Nouvelles admissions : déplacés", totalNew.filter((c) => c.residency === "displaced")),
        r("IV.6-015/refugee", "Nouvelles admissions : réfugiés", totalNew.filter((c) => c.residency === "refugee")),
        r("IV.6-016", "Bénéficiaires testés pour le VIH", admitted.filter((c) => c.hivTested)),
        r("IV.6-017", "Bénéficiaires / accompagnants ayant reçu le counseling ANJE", admitted.filter((c) => c.anjeCounseling)),
      ],
      note: "Colonnes = âge à l'admission. Les stocks d'ATPE, d'amoxicilline… figurent dans le tableau des intrants nutritionnels (IV.6), jours de rupture compris.",
    };
  });
}

function growthTable(input: Rma3ProgramsInput): ActivityTable {
  const inMonth = inRange(input.start, input.end);
  const visits = input.growthVisits.filter((v) => inMonth(v.visitDate));
  const months = (v: ProgramGrowthVisit) => ageInCompletedMonths(v.patient.birthDate, v.visitDate);
  const ev = (v: ProgramGrowthVisit) => ({ id: v.patientId, at: v.visitDate });
  const r = (code: string, label: string, filter: (v: ProgramGrowthVisit) => boolean) => row(code, label, none(), visits.filter(filter).map(ev), true);
  return {
    section: "III.9",
    title: "Alimentation du nourrisson et suivi de la croissance",
    columns: [],
    rows: [
      r("III.9-002", "Enfants de moins de 6 mois recevant de l'eau", (v) => months(v) < 6 && v.receivesWater === true),
      r("III.9-003", "Enfants ayant commencé l'alimentation de complément avant 6 mois", (v) => months(v) < 6 && v.complementaryFood === true),
      r("III.9-004", "Enfants de 0-59 mois suivis pour la croissance", (v) => months(v) < 60 && v.weightKg !== null),
      r("III.9-006", "Enfants supplémentés en multivitamines", (v) => v.multivitaminGiven),
      r("III.9-007", "Enfants de 2 ans continuant d'être allaités", (v) => months(v) >= 24 && months(v) < 36 && v.stillBreastfed === true),
    ],
    note: "Enfants comptés une fois par mois. Suivi de croissance = visite avec poids mesuré. « 2 ans » = 24 à 35 mois.",
  };
}

function bloodTable(input: Rma3ProgramsInput): ActivityTable {
  const inMonth = inRange(input.start, input.end);
  type Ev = { id: string; at: Date };
  const collected = input.donations.filter((d) => inMonth(d.collectedAt));
  const bag = (d: ProgramDonation): Ev => ({ id: d.id, at: d.collectedAt });
  const donor = (d: ProgramDonation): Ev => ({ id: d.donorId, at: d.collectedAt });
  const b = (code: string, label: string, list: ProgramDonation[], at: (d: ProgramDonation) => Ev = bag) => row(code, label, none<Ev>(), list.map(at), false);
  const dn = (code: string, label: string, filter: (d: ProgramDonation) => boolean) => row(code, label, none<Ev>(), collected.filter(filter).map(donor), true);
  const tested = (r: string) => r !== "not_done";
  const pos = (r: string) => r === "positive";
  const allTested = (d: ProgramDonation) => [d.hivResult, d.hbvResult, d.hcvResult, d.syphilisResult].every(tested);
  return {
    section: "V.6",
    title: "Transfusion sanguine",
    columns: [],
    rows: [
      b("V.6-001", "Poches de sang prélevées / collectées", collected),
      b("V.6-025", "Poches collectées au poste fixe", collected.filter((d) => d.sessionId === null)),
      b("V.6-026", "Poches collectées en poste mobile", collected.filter((d) => d.sessionId !== null)),
      { code: "V.6-024", label: "Collectes mobiles effectuées", cells: {}, total: input.mobileSessions.filter((s) => inMonth(s.heldAt)).length },
      b("V.6-003", "Poches testées selon les normes (VIH, VHB, VHC, syphilis)", collected.filter(allTested)),
      b("V.6-005", "Poches testées pour le VIH", collected.filter((d) => tested(d.hivResult))),
      b("V.6-007", "Poches positives au VIH", collected.filter((d) => pos(d.hivResult))),
      b("V.6-004", "Poches servies", input.donations.filter((d) => inMonth(d.servedAt)), (d) => ({ id: d.id, at: d.servedAt! })),
      b("V.6-002", "Poches transfusées", input.donations.filter((d) => inMonth(d.transfusedAt)), (d) => ({ id: d.id, at: d.transfusedAt! })),
      b("V.6-010", "Poches détruites", input.donations.filter((d) => inMonth(d.destroyedAt)), (d) => ({ id: d.id, at: d.destroyedAt! })),
      dn("V.6-006", "Donneurs volontaires / bénévoles", (d) => d.donorType === "voluntary"),
      dn("V.6-008", "Donneurs fidélisés", (d) => d.donorType === "voluntary" && d.previousDonations > 0),
      dn("V.6-009", "Donneurs de famille", (d) => d.donorType === "family"),
      dn("V.6-011", "Donneurs testés pour l'hépatite B", (d) => tested(d.hbvResult)),
      dn("V.6-012", "Donneurs positifs à l'hépatite B", (d) => pos(d.hbvResult)),
      dn("V.6-013", "Donneurs testés pour l'hépatite C", (d) => tested(d.hcvResult)),
      dn("V.6-014", "Donneurs positifs à l'hépatite C", (d) => pos(d.hcvResult)),
      dn("V.6-015", "Donneurs testés pour la syphilis", (d) => tested(d.syphilisResult)),
      dn("V.6-016", "Donneurs positifs à la syphilis", (d) => pos(d.syphilisResult)),
      dn("V.6-017", "Donneurs testés pour le VIH", (d) => tested(d.hivResult)),
      dn("V.6-018", "Donneurs positifs au VIH", (d) => pos(d.hivResult)),
      dn("V.6-019", "Donneurs indéterminés au VIH", (d) => d.hivResult === "indeterminate"),
      dn("V.6-020", "Donneurs co-infectés VIH / VHB", (d) => pos(d.hivResult) && pos(d.hbvResult) && !pos(d.hcvResult)),
      dn("V.6-021", "Donneurs co-infectés VIH / VHC", (d) => pos(d.hivResult) && pos(d.hcvResult) && !pos(d.hbvResult)),
      dn("V.6-022", "Donneurs co-infectés VIH / VHB / VHC", (d) => pos(d.hivResult) && pos(d.hbvResult) && pos(d.hcvResult)),
      { code: "V.6-023", label: "Donneurs VIH+ mis sous ARV", cells: {}, total: input.donorsStartedOnArt },
    ],
    note: "Donneurs comptés une fois par mois ; fidélisé = donneur volontaire ayant déjà donné. Mis sous ARV = donneur relié à un dossier patient enrôlé sous TARV dans le mois.",
  };
}

const STAFF_COLUMNS: DisaggregationColumn[] = [
  ["total", "Effectif"],
  ["state", "Payé État"],
  ["local", "Payé local"],
  ["inPost", "En poste"],
  ["retireNext", "Retraite N+1"],
  ["retiredYear", "Retraités dans l'année"],
].flatMap(([key, label]) => ["M", "F"].map((sex) => ({ key: `${key}_${sex}`, label: `${label} ${sex}` })));

function staffTable(input: Rma3ProgramsInput): ActivityTable {
  const { end } = input;
  const year = new Date(end.getTime() - 1).getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const present = (s: ProgramStaff) => (!s.hiredAt || s.hiredAt < end) && (!s.leftAt || s.leftAt >= end);
  const retired = (s: ProgramStaff) => s.retirementDate !== null && s.retirementDate < end;
  const rows = STAFF_CADRES.map((cadre) => {
    const cells: Record<string, number> = Object.fromEntries(STAFF_COLUMNS.map((c) => [c.key, 0]));
    let total = 0;
    for (const s of input.staff) {
      if (s.cadre !== cadre.code || !present(s) || (s.sex !== "M" && s.sex !== "F")) continue;
      const add = (key: string) => (cells[`${key}_${s.sex}`] += 1);
      if (retired(s)) {
        if (s.retirementDate! >= yearStart) add("retiredYear");
        continue;
      }
      total += 1;
      add("total");
      add(s.payer);
      if (s.inPost) add("inPost");
      if (s.retirementDate && s.retirementDate.getUTCFullYear() === year + 1) add("retireNext");
    }
    return { code: cadre.rma3Code, label: cadre.label, cells, total };
  });
  return {
    section: "VI.5",
    title: "Ressources humaines",
    columns: STAFF_COLUMNS,
    rows,
    note: "Registre du personnel (Paramètres > Personnel) à la fin du mois. Retraité = date de retraite passée ; retraite N+1 = date de retraite l'an prochain.",
  };
}
