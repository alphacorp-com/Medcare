import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { ActivityTable, Rma3AefiRow, Rma3CauseTable, Rma3ColdChain, Rma3HpvRow, Rma3KeyValueRow, Rma3MalariaRow, Rma3MorbidityTable, Rma3ReportData, Rma3TbRow, Rma3VaccinationRow } from "./rma3";
import { RMA3_CAUSE_SECTIONS } from "./rma3-rubrics-default";
import { rma3FormSection } from "./rma3-morbidity-default";
import type { Rma3StockCategory } from "@/lib/stock/input";
import type { StockReportItemRow } from "@/lib/stock/report-data";
import { schemeColumns, type IndicatorRow } from "@/lib/hiv/rma3-hiv";
import { PROVISIONAL_AGE_SCHEMES, RMA3_AGE_SCHEMES } from "@/lib/reports/age-bands";
import { formatManualValue, type Rma3ManualReport } from "@/lib/rma3-manual/report";

const FRENCH_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatPeriodFr(period: string): string {
  const year = period.slice(0, 4);
  const month = Number(period.slice(4, 6));
  return `${FRENCH_MONTHS[month - 1]} ${year}`;
}

const INCLUDED_SECTIONS = [
  "Identification de la formation sanitaire",
  "II.1 - Consultations Prénatales, Accouchements et Naissances",
  "II.1.1 / II.1.2 / II.1.3 / II.1.4 - CPN par rang, stratégie avancée, doses de Td, hémoglobine ; accouchements, GATPA, complications RMA3, avortements, décès maternels par cause et revus ; consultations post-natales ; nouveau-nés (prématurité, petit poids, kangourou, couveuse, asphyxie, mort-nés frais / macérés, décès néonatals par cause et revus)",
  "II.1.5 - Planification familiale (visites, conseil, nouvelles acceptantes, références ASC, utilisateurs par méthode, post-partum) ; III.9 - Mise au sein dans l'heure",
  "IV.2.1 - Contacts CPN et TPI par rang ; IV.2.4-5 - Consultations, hospitalisations, décès toutes causes et cas suspects de paludisme (< 5 ans / 5 ans et + / femmes enceintes, par sexe)",
  "IV.3 - Nouveaux cas, rechutes, reprises, échecs, statut VIH, mise sous traitement et suivi au laboratoire (âge × forme)",
  "IV.4.4 - Personnes dépistées pour l'hypertension artérielle",
  "III.1 - Séances de vaccination planifiées / réalisées (stratégie fixe et avancée)",
  "III.2 - Immunisation des Enfants (PEV) par tranche d'âge, stratégie, sexe et populations spéciales",
  "III.3 - Vaccination VPH (9 ans et 10-13 ans)",
  "III.4 - Chaîne du froid (équipements, températures, alarmes)",
  "III.6 - MAPI par vaccin (mineures / graves)",
  "IV.2 - Lutte contre le Paludisme",
  "IV.3 - Notification et Résultats du Traitement Antituberculeux",
  "V.1 - Activité générale (consultations, hospitalisations, jours d'hospitalisation, références, interventions, décès péri-opératoires, décès, capacité)",
  "V.3 / V.4 / V.5 - Principales causes de consultation, d'hospitalisation et de décès (diagnostics codés CIM-10)",
  "II.2, III.7, IV.4, IV.4.9, IV.4.10, IV.4.11, IV.5 - Nouveaux cas issus des diagnostics codés CIM-10 (lignes dérivables d'un diagnostic uniquement, voir la note de chaque tableau)",
  "II.3 - PTME (CPN, salle d'accouchement, références ASC/OBC, charge virale, suivi post-natal et enfants exposés)",
  "II.1.1 - Dépistage de la syphilis et de l'hépatite B en CPN",
  "IV.1.1 / IV.1.2 / IV.1.4 - Dépistage VIH, suivi des PVVIH sous ARV, file active par protocole",
  "IV.1.3 - Hépatites virales et IST",
  "Formulaire mensuel saisi : accouchements et naissances en communauté, communication et recherche des perdus de vue (III.1), boîtes de sécurité (III.4), supplémentation scolaire (III.8), TPI / TPIn et activité des ASC en communauté (IV.2), communication diabète / HTA (IV.4.5), participation communautaire (V.10), environnement, supervisions, recettes hors facturation, dépenses, fonctionnalité et patrimoine (VI.1-VI.4, VI.6)",
  "V.7, III.5, IV.2.7, V.9, IV.6 - Gestion des stocks des articles classés dans une catégorie RMA3 (stock début/fin, entrées, consommation, pertes, CMM, jours de rupture ; doses et pertes PEV)",
];

const EXCLUDED_SECTIONS = [
  "Registre / stock des médicaments antituberculeux",
  "V.6 Banque de sang / transfusion",
  "V.7 Médicaments traceurs non encore classés « traceur » dans l'inventaire (seuls les articles classés sont produits)",
  "V.8 Pharmacovigilance",
  "V.9 Oxygène : équipements et cas d'hypoxémie (le stock d'oxygène est inclus)",
  "VI.3 Recettes issues de la facturation des patients (billet de cession, hospitalisation, examens, chirurgie, pharmacie…) et sous-totaux des recettes",
  "VI.5 Ressources humaines",
  "IV.2.4-5 Paludisme traité gratuitement (prise en charge exonérée)",
];

function cell(text: string, opts?: { bold?: boolean; shaded?: boolean }): TableCell {
  return new TableCell({
    shading: opts?.shaded ? { fill: "E8EEF7" } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts?.bold })] })],
  });
}

function blankLineCell(): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: "_______________________" })],
      }),
    ],
  });
}

function keyValueTable(rows: Rma3KeyValueRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: [cell(row.label), cell(String(row.value))],
        })
    ),
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text })] });
}

const OWNERSHIP_LABELS: Record<NonNullable<Rma3ReportData["identification"]["ownership"]>, string> = {
  public: "Public",
  private: "Privé",
  faith_based: "Confessionnel",
  community: "Communautaire",
  other: "Autre",
};

function identificationTable(data: Rma3ReportData["identification"]): Table {
  const rows: [string, string | null][] = [
    ["Nom de la formation sanitaire", data.facilityName],
    ["Adresse", data.address],
    ["Téléphone", data.phone],
    ["Email", data.email],
    ["Région", data.region],
    ["Département", data.department],
    ["Arrondissement", data.arrondissement],
    ["District de santé", data.district],
    ["Aire de santé", data.healthArea],
    ["Villages / quartiers desservis", data.villagesServed === null ? null : String(data.villagesServed)],
    ["dont en stratégie avancée (> 5 km)", data.villagesOutreach === null ? null : String(data.villagesOutreach)],
    ["Statut", data.ownership ? OWNERSHIP_LABELS[data.ownership] : null],
    ["Responsable de la formation sanitaire", data.facilityManagerName],
    ["Gestionnaire des données", data.dataManagerName],
    ["Téléphone du gestionnaire des données", data.dataManagerPhone],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [cell(label, { bold: true }), value ? cell(value) : blankLineCell()],
        })
    ),
  });
}

// III.2: age band × strategy (F = fixe, A = avancée/mobile), sex, special populations.
function vaccinationTable(rows: Rma3VaccinationRow[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      "Antigène / Dose",
      "0-11 m F", "0-11 m A", "12-23 m F", "12-23 m A", "24-59 m F", "24-59 m A", "5 ans et +",
      "Garçons", "Filles", "dont nomades", "dont pygmées", "dont réfugiés", "Hors calendrier", "Total",
    ].map((text) => cell(text, { bold: true, shaded: true })),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: [
          cell(`${r.antigenName} (dose ${r.doseNumber})`),
          cell(String(r.byStrategy.fixed.ageUnder12m)),
          cell(String(r.byStrategy.outreach.ageUnder12m)),
          cell(String(r.byStrategy.fixed.age12to23m)),
          cell(String(r.byStrategy.outreach.age12to23m)),
          cell(String(r.byStrategy.fixed.age24to59m)),
          cell(String(r.byStrategy.outreach.age24to59m)),
          cell(String(r.age5yPlus)),
          cell(String(r.boys)),
          cell(String(r.girls)),
          cell(String(r.nomad)),
          cell(String(r.pygmy)),
          cell(String(r.refugee)),
          cell(String(r.outOfSchedule)),
          cell(String(r.total)),
        ],
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

function sessionsTable(sessions: Rma3ReportData["epi"]["sessions"]): Table {
  const header = new TableRow({ tableHeader: true, children: ["Séances de vaccination", "Planifiées", "Réalisées"].map((t) => cell(t, { bold: true, shaded: true })) });
  const row = (label: string, s: { planned: number; held: number }) => new TableRow({ children: [cell(label), cell(String(s.planned)), cell(String(s.held))] });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, row("Stratégie fixe", sessions.fixed), row("Stratégie avancée / mobile", sessions.outreach)],
  });
}

function hpvTable(rows: Rma3HpvRow[]): Table {
  const header = new TableRow({ tableHeader: true, children: ["VPH", "Fixe", "Avancée", "dont réfugiés"].map((t) => cell(t, { bold: true, shaded: true })) });
  const body = rows.map((r) => new TableRow({ children: [cell(r.label), cell(String(r.fixed)), cell(String(r.outreach)), cell(String(r.refugees))] }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

function coldChainTable(c: Rma3ColdChain): Table {
  const temp = (v: number | null) => (v === null ? "—" : `${v} °C`);
  const rows: [string, string][] = [
    ["Total équipements de la chaîne du froid", String(c.equipmentTotal)],
    ["Équipements fonctionnels", String(c.equipmentFunctional)],
    ["Température minimale enregistrée", temp(c.minTemperature)],
    ["Température maximale enregistrée", temp(c.maxTemperature)],
    ["Alarmes basses températures (sous la plage, < +2 °C au réfrigérateur)", String(c.lowAlarms)],
    ["Alarmes températures élevées (au-dessus de la plage, > +8 °C au réfrigérateur)", String(c.highAlarms)],
    ["Relevés de température du mois", String(c.readings)],
    ["Équipements sans aucun relevé dans le mois", String(c.equipmentWithoutReadings)],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) => new TableRow({ children: [cell(label), cell(value)] })),
  });
}

function aefiTable(rows: Rma3AefiRow[]): Table {
  const header = new TableRow({ tableHeader: true, children: ["MAPI", "Mineures", "Graves"].map((t) => cell(t, { bold: true, shaded: true })) });
  const body = rows.map((r) => new TableRow({ children: [cell(`MAPI ${r.label}`), cell(String(r.minor)), cell(String(r.serious))] }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

function malariaTable(rows: Rma3MalariaRow[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: ["Indicateur", "0-5 ans", "Plus de 5 ans", "Femmes enceintes", "Total"].map((text) =>
      cell(text, { bold: true, shaded: true })
    ),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: [cell(r.label), cell(String(r.under5)), cell(String(r.over5)), cell(String(r.pregnant)), cell(String(r.total))],
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

function tbTable(rows: Rma3TbRow[], firstColumnLabel: string): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [firstColumnLabel, "0-4 ans", "5-14 ans", "15 ans et +", "Total"].map((text) =>
      cell(text, { bold: true, shaded: true })
    ),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: [cell(r.label), cell(String(r.age0to4)), cell(String(r.age5to14)), cell(String(r.age15Plus)), cell(String(r.total))],
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

// V.3 / V.4 / V.5: one row per active rubric, then the unclassified diagnoses so the
// table can be reconciled with the activity.
function causeTable(table: Rma3CauseTable): Table {
  const header = new TableRow({
    tableHeader: true,
    children: ["Cause", "0-59 mois", "5-14 ans", "15 ans et +", "Total"].map((text) => cell(text, { bold: true, shaded: true })),
  });
  const rows = [...table.rows, table.unclassified].map(
    (r) =>
      new TableRow({
        children: [cell(r.label), cell(String(r.age0to59m)), cell(String(r.age5to14)), cell(String(r.age15plus)), cell(String(r.total))],
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
}

// II.2 / III.7 / IV.4 / IV.5: new cases per rubric in the section's RMA3 breakdown, a
// deaths column where the form has one, then the form rows a diagnosis cannot produce.
function morbidityTable(table: Rma3MorbidityTable): (Paragraph | Table)[] {
  const hasDeaths = table.rows.some((r) => r.deaths !== null);
  const header = new TableRow({
    tableHeader: true,
    children: ["Rubrique", ...table.columns.map((c) => c.label), "Total nouveaux cas", ...(hasDeaths ? ["Décès"] : [])].map((text) =>
      cell(text, { bold: true, shaded: true })
    ),
  });
  const rows = table.rows.map(
    (r) =>
      new TableRow({
        children: [
          cell(r.label),
          ...table.columns.map((c) => cell(String(r.cells[c.key] ?? 0))),
          cell(String(r.total)),
          ...(hasDeaths ? [cell(String(r.deaths ?? 0))] : []),
        ],
      })
  );
  return [
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }),
    new Paragraph({
      children: [new TextRun({ italics: true, size: 16, text: `Non produit (à compléter manuellement) : ${table.notDerivable.join(" ; ")}.` })],
    }),
  ];
}

// Activity tables (rma3-activity.ts): one column per age band / sex / form, then the total.
function activityTable(table: ActivityTable): (Paragraph | Table)[] {
  const header = new TableRow({
    tableHeader: true,
    children: ["Indicateur", ...table.columns.map((c) => c.label), "Total"].map((t) => cell(t, { bold: true, shaded: true })),
  });
  const body = table.rows.map(
    (r) =>
      new TableRow({
        children: [cell(`${r.code} ${r.label}`), ...table.columns.map((c) => cell(String(r.cells[c.key] ?? 0))), cell(String(r.total))],
      })
  );
  return [
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] }),
    ...(table.note ? [new Paragraph({ children: [new TextRun({ italics: true, size: 16, text: table.note })] })] : []),
  ];
}

// The tables of the given sections, in the order of `sections` (a section may have several).
function activitySections(tables: ActivityTable[], sections: string[]): (Paragraph | Table)[] {
  return sections.flatMap((section) => tables.filter((t) => t.section === section).flatMap((t) => [sectionHeading(`${t.section} - ${t.title}`), ...activityTable(t)]));
}

// The RMA3 monthly form: one table per run of indicators sharing a breakdown; "—" = not
// entered (never printed as 0).
function manualSections(manual: Rma3ManualReport): (Paragraph | Table)[] {
  const statusText =
    manual.status === "validated"
      ? `Formulaire mensuel validé le ${manual.validatedAt?.toLocaleDateString("fr-FR") ?? "—"} (${manual.filledCells} / ${manual.totalCells} cases saisies).`
      : `ATTENTION : formulaire mensuel NON VALIDÉ (brouillon, ${manual.filledCells} / ${manual.totalCells} cases saisies). « — » = non saisi.`;
  return [
    sectionHeading("Formulaire mensuel (données saisies)"),
    new Paragraph({ children: [new TextRun({ bold: manual.status !== "validated", italics: true, text: statusText })] }),
    ...manual.sections.flatMap((section) => [
      sectionHeading(`${section.code.replace(/-[RD]$/, "")} - ${section.title}`),
      ...section.tables.map((table) => {
        const single = table.columns.length === 1;
        const header = new TableRow({
          tableHeader: true,
          children: ["Indicateur", ...(single ? ["Valeur"] : [...table.columns.map((c) => c.label), "Total"])].map((t) => cell(t, { bold: true, shaded: true })),
        });
        const body = table.rows.map(
          (r) =>
            new TableRow({
              children: [
                cell(`${r.code} ${r.label}`),
                ...table.columns.map((c) => cell(formatManualValue(r.cells[c.key], r.kind))),
                ...(single ? [] : [cell(formatManualValue(r.total, r.kind))]),
              ],
            })
        );
        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
      }),
    ]),
  ];
}

const STOCK_SECTIONS: { category: Rma3StockCategory; heading: string }[] = [
  { category: "epi_input", heading: "III.5 - Gestion des intrants PEV" },
  { category: "antimalarial", heading: "IV.2.7 - Gestion des stocks d'antipaludiques" },
  { category: "nutrition", heading: "IV.6 - Gestion des intrants nutritionnels" },
  { category: "tracer", heading: "V.7 - Disponibilité des médicaments traceurs" },
  { category: "oxygen", heading: "V.9 - Oxygène médical (stock)" },
];

// One row per article of the category; vaccines add their doses and wastage.
function stockTable(rows: StockReportItemRow[]): Table {
  const withVaccine = rows.some((r) => r.vaccine);
  const header = new TableRow({
    tableHeader: true,
    children: [
      "Article",
      "Stock début",
      "Reçu",
      "Consommé",
      "Pertes",
      "Ajustements",
      "Stock fin",
      "CMM",
      "Jours de rupture",
      ...(withVaccine ? ["Doses administrées", "Doses perdues", "Taux de perte"] : []),
    ].map((text) => cell(text, { bold: true, shaded: true })),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: [
          cell(r.unit ? `${r.name} (${r.unit})` : r.name),
          cell(String(r.opening)),
          cell(String(r.received)),
          cell(String(r.consumed)),
          cell(String(r.losses.expired + r.losses.damaged + r.losses.lost)),
          cell(String(r.adjusted)),
          cell(String(r.closing)),
          cell(String(r.cmm)),
          cell(String(r.stockoutDays)),
          ...(withVaccine
            ? [
                cell(r.vaccine ? String(r.vaccine.dosesAdministered) : "—"),
                cell(r.vaccine ? String(r.vaccine.dosesWasted) : "—"),
                cell(r.vaccine?.wastageRate !== null && r.vaccine?.wastageRate !== undefined ? `${r.vaccine.wastageRate} %` : "—"),
              ]
            : []),
        ],
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

// HIV / hepatitis indicator rows: the age bands of the row's scheme (sexes added up), then
// M / F and the total. The full age × sex detail is in the app (Programmes de santé).
const BANDS = {
  hiv13: PROVISIONAL_AGE_SCHEMES.hiv13,
  hep9: PROVISIONAL_AGE_SCHEMES.hep9,
  ptme: RMA3_AGE_SCHEMES.ptme,
  mother: RMA3_AGE_SCHEMES.mother,
  none: null,
} as const;

function indicatorTable(rows: IndicatorRow[]): Table {
  const scheme = rows[0]?.scheme ?? "none";
  const bands = BANDS[scheme] ?? [];
  const bySex = scheme === "hiv13" || scheme === "hep9";
  const columns = schemeColumns(scheme);
  const header = new TableRow({
    tableHeader: true,
    children: ["Indicateur", ...bands.map((b) => b.label), ...(bySex ? ["M", "F"] : []), "Total"].map((t) => cell(t, { bold: true, shaded: true })),
  });
  const sum = (r: IndicatorRow, match: (key: string) => boolean) =>
    columns.filter((c) => match(c.key)).reduce((total, c) => total + (r.cells[c.key] ?? 0), 0);
  const body = rows.map(
    (r) =>
      new TableRow({
        children: [
          cell(`${r.code.replace(/^RMA3-/, "")} ${r.label}`),
          ...bands.map((b) => cell(String(sum(r, (k) => k === b.key || k.startsWith(`${b.key}_`))))),
          ...(bySex ? [cell(String(sum(r, (k) => k.endsWith("_M")))), cell(String(sum(r, (k) => k.endsWith("_F"))))] : []),
          cell(String(r.total)),
        ],
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

const ENTRY_POINT_LABELS: Record<string, string> = {
  index_case: "Cas index",
  emergency: "Urgences",
  antenatal: "CPN",
  maternity: "Maternité",
  postnatal: "Post-natal / allaitement",
  pediatric: "Pédiatrie",
  inpatient: "Hospitalisation",
  outpatient: "Consultation externe",
  vct: "CDV",
  tb: "Tuberculose",
  sti: "IST",
  family_planning: "Planification familiale",
  community: "Communautaire",
  other: "Autre",
};

function hivSections(hiv: Rma3ReportData["hiv"]): (Paragraph | Table)[] {
  const note = (text: string) => new Paragraph({ children: [new TextRun({ italics: true, size: 16, text })] });
  return [
    sectionHeading("II.1.1 - Dépistage de la syphilis et de l'hépatite B en CPN"),
    indicatorTable(hiv.antenatalScreening),
    sectionHeading("II.3.1 - PTME en consultation prénatale"),
    indicatorTable(hiv.pmtctAntenatal),
    sectionHeading("II.3.2 - PTME en salle d'accouchement"),
    indicatorTable(hiv.pmtctMaternity),
    sectionHeading("II.3.3 - Femmes enceintes référées par les ASC / OBC"),
    indicatorTable(hiv.pmtctReferrals),
    sectionHeading("II.3.4 - Charge virale des femmes enceintes VIH+"),
    indicatorTable(hiv.pmtctViralLoad),
    sectionHeading("II.3.5 - Suivi post-natal : enfants exposés et femmes allaitantes"),
    indicatorTable(hiv.pmtctPostnatal.filter((r) => r.scheme === "none")),
    indicatorTable(hiv.pmtctPostnatal.filter((r) => r.scheme !== "none")),
    sectionHeading("IV.1.1 - Dépistage du VIH"),
    indicatorTable(hiv.hivTesting),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: ["Porte d'entrée", "Testées", "Testées positives", "Mises sous TARV"].map((t) => cell(t, { bold: true, shaded: true })) }),
        ...hiv.hivTestingByEntryPoint.map(
          (e) => new TableRow({ children: [cell(ENTRY_POINT_LABELS[e.entryPoint] ?? e.entryPoint), cell(String(e.tested)), cell(String(e.positive)), cell(String(e.startedArt))] })
        ),
      ],
    }),
    sectionHeading("IV.1.2 - Suivi des PVVIH sous ARV"),
    indicatorTable(hiv.artFollowUp),
    note("Non venus 1 mois = 30-59 jours après le rendez-vous, 2 mois = 60-89 jours, perdus de vue = 90 jours et plus (hors file active) ; état à la fin du mois."),
    sectionHeading("IV.1.4 - PVVIH sous ARV par protocole"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: ["Protocole", "Ligne", "PVVIH (file active)"].map((t) => cell(t, { bold: true, shaded: true })) }),
        ...hiv.artByRegimen.map((r) => new TableRow({ children: [cell(r.label), cell(String(r.line)), cell(String(r.patients))] })),
      ],
    }),
    sectionHeading("IV.1.3 - Hépatites virales et IST"),
    indicatorTable(hiv.hepatitisSti),
    note(
      "Tranches d'âge VIH (13) et hépatites/IST (9) PROVISOIRES, à valider avec le formulaire officiel. Personnes comptées une fois par indicateur et par mois ; « déjà connu positif » = test VIH positif ou enrôlement TARV antérieur."
    ),
  ];
}

export async function buildRma3Document(
  data: Rma3ReportData,
  meta: { generatedByName: string; generatedByEmail: string }
): Promise<Buffer> {
  const generatedAt = new Date();

  const portraitChildren: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "RÉPUBLIQUE DU CAMEROUN", size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "REPUBLIC OF CAMEROON", size: 18, italics: true })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new TextRun({ text: "MINISTÈRE DE LA SANTÉ PUBLIQUE", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "SYSTÈME NATIONAL D'INFORMATION SANITAIRE", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "RAPPORT MENSUEL D'ACTIVITÉS - RMA 3", bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Mois : ${formatPeriodFr(data.period)}`, bold: true })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "FFF3CD" },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "E0A800" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0A800" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "E0A800" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "E0A800" },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      bold: true,
                      italics: true,
                      text:
                        "Document généré automatiquement par MedCare à partir des données de l'établissement — " +
                        "brouillon de travail à vérifier et compléter avant toute soumission officielle au MINSANTE. " +
                        "Contient des données de santé sensibles (VIH, hépatites) : à ne transmettre qu'aux destinataires habilités.",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    sectionHeading("Identification"),
    identificationTable(data.identification),
    sectionHeading("II.1 - Consultations Prénatales, Accouchements et Naissances"),
    keyValueTable(data.maternalHealth),
    sectionHeading("V.1 - Consultations, Hospitalisations, Décès et Capacité"),
    keyValueTable(data.facilityActivity),
  ];

  const landscapeChildren: (Paragraph | Table)[] = [
    ...activitySections(data.activity, ["II.1.1", "II.1.2", "II.1.3", "II.1.4", "II.1.5", "III.9"]),
    sectionHeading("III.1 - Séances de vaccination"),
    sessionsTable(data.epi.sessions),
    sectionHeading("III.2 - Immunisation des Enfants (PEV)"),
    new Paragraph({
      children: [
        new TextRun({
          italics: true,
          text: "Répartition combinée (stratégie fixe et mobile non distinguée - donnée non disponible).",
        }),
      ],
    }),
    vaccinationTable(data.vaccination),
    new Paragraph({
      children: [
        new TextRun({
          italics: true,
          size: 16,
          text: "F = stratégie fixe, A = stratégie avancée / mobile. Les doses enregistrées avant la saisie de la stratégie et du statut de population sont comptées en stratégie fixe, population générale.",
        }),
      ],
    }),
    sectionHeading("III.3 - Vaccination contre le VPH"),
    hpvTable(data.epi.hpv),
    sectionHeading("III.4 - Chaîne du froid"),
    coldChainTable(data.epi.coldChain),
    sectionHeading("III.6 - Manifestations post-vaccinales indésirables (MAPI)"),
    aefiTable(data.epi.aefi),
    sectionHeading("IV.2 - Lutte contre le Paludisme"),
    malariaTable(data.malaria),
    ...activitySections(data.activity, ["IV.2.1", "IV.2.4-5"]),
    sectionHeading("IV.3.3 - Notification des Cas de Tuberculose"),
    tbTable(data.tuberculosis.notifications, "Classification"),
    sectionHeading("IV.3.4 - Résultats du Traitement Antituberculeux"),
    tbTable(data.tuberculosis.outcomes, "Issue du traitement"),
    ...activitySections(data.activity, ["IV.3", "IV.4.4", "V.1"]),
    ...data.causes.flatMap((table) => [sectionHeading(`${table.section} - ${RMA3_CAUSE_SECTIONS[table.section]}`), causeTable(table)]),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          italics: true,
          text:
            "Tableaux suivants : nouveaux cas = diagnostics de consultation (principaux et secondaires) marqués « nouveau cas », " +
            "comptés dans chaque rubrique qui couvre leur code ; un total peut inclure des patients de sexe non renseigné.",
        }),
      ],
    }),
    ...data.morbidity.flatMap((table) => [sectionHeading(`${rma3FormSection(table.section)} - ${table.title}`), ...morbidityTable(table)]),
    ...hivSections(data.hiv),
    ...STOCK_SECTIONS.flatMap(({ category, heading }) => {
      const rows = data.stock.filter((r) => r.rma3Category === category);
      return rows.length ? [sectionHeading(heading), stockTable(rows)] : [];
    }),
    ...(data.stock.length
      ? [
          new Paragraph({
            children: [
              new TextRun({
                italics: true,
                size: 16,
                text:
                  "Stocks : tous dépôts confondus, en unités de stock (flacons pour les vaccins). CMM = consommation moyenne des 3 derniers mois. " +
                  "Jour de rupture = journée terminée sans lot non périmé en stock. Taux de perte PEV = doses restées dans des flacons ouverts puis jetés ou périmés.",
              }),
            ],
          }),
        ]
      : []),
    ...manualSections(data.manual),
    sectionHeading("Portée de ce document généré automatiquement"),
    new Paragraph({ children: [new TextRun({ bold: true, text: "Sections incluses (données réelles calculées) :" })] }),
    ...INCLUDED_SECTIONS.map((s) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: s })] })),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          bold: true,
          text: "Sections NON incluses dans ce document (aucune donnée disponible dans MedCare - à compléter manuellement sur le formulaire officiel) :",
        }),
      ],
    }),
    ...EXCLUDED_SECTIONS.map((s) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: s })] })),
    new Paragraph({
      spacing: { before: 300 },
      children: [
        new TextRun({
          italics: true,
          text: `Généré par ${meta.generatedByName} (${meta.generatedByEmail}) le ${generatedAt.toLocaleDateString("fr-FR")} à ${generatedAt.toLocaleTimeString("fr-FR")}.`,
        }),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      { properties: {}, children: portraitChildren },
      {
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
        children: landscapeChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
