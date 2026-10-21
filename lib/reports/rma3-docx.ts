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
import { Rma3AefiRow, Rma3CauseTable, Rma3ColdChain, Rma3HpvRow, Rma3KeyValueRow, Rma3MalariaRow, Rma3MorbidityTable, Rma3ReportData, Rma3TbRow, Rma3VaccinationRow } from "./rma3";
import { RMA3_CAUSE_SECTIONS } from "./rma3-rubrics-default";
import { rma3FormSection } from "./rma3-morbidity-default";
import type { Rma3StockCategory } from "@/lib/stock/input";
import type { StockReportItemRow } from "@/lib/stock/report-data";

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
  "III.1 - Séances de vaccination planifiées / réalisées (stratégie fixe et avancée)",
  "III.2 - Immunisation des Enfants (PEV) par tranche d'âge, stratégie, sexe et populations spéciales",
  "III.3 - Vaccination VPH (9 ans et 10-13 ans)",
  "III.4 - Chaîne du froid (équipements, températures, alarmes)",
  "III.6 - MAPI par vaccin (mineures / graves)",
  "IV.2 - Lutte contre le Paludisme",
  "IV.3 - Notification et Résultats du Traitement Antituberculeux",
  "V.1 - Activité générale (consultations, hospitalisations, décès, capacité)",
  "V.3 / V.4 / V.5 - Principales causes de consultation, d'hospitalisation et de décès (diagnostics codés CIM-10)",
  "II.2, III.7, IV.4, IV.4.9, IV.4.10, IV.4.11, IV.5 - Nouveaux cas issus des diagnostics codés CIM-10 (lignes dérivables d'un diagnostic uniquement, voir la note de chaque tableau)",
  "V.7, III.5, IV.2.7, V.9, IV.6 - Gestion des stocks des articles classés dans une catégorie RMA3 (stock début/fin, entrées, consommation, pertes, CMM, jours de rupture ; doses et pertes PEV)",
];

const EXCLUDED_SECTIONS = [
  "III.1 Activités de communication (causeries, sensibilisation, visites à domicile, recherche des perdus de vue)",
  "III.4 Boîtes de sécurité utilisées / détruites",
  "IV.1.1 Dépistage VIH en population générale (hors grossesse)",
  "Registre / stock des médicaments antituberculeux",
  "V.6 Banque de sang / transfusion",
  "V.7 Médicaments traceurs non encore classés « traceur » dans l'inventaire (seuls les articles classés sont produits)",
  "V.8 Pharmacovigilance",
  "V.9 Oxygène : équipements et cas d'hypoxémie (le stock d'oxygène est inclus)",
  "VI.2-VI.6 Gouvernance, finances, ressources humaines, patrimoine",
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

function identificationTable(data: Rma3ReportData["identification"]): Table {
  const rows: [string, string | null][] = [
    ["Nom de la formation sanitaire", data.facilityName],
    ["Adresse", data.address],
    ["Téléphone", data.phone],
    ["Email", data.email],
    ["Région", data.region],
    ["Département", data.department],
    ["District de santé", data.district],
    ["Aire de santé", data.healthArea],
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
                        "brouillon de travail à vérifier et compléter avant toute soumission officielle au MINSANTE.",
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
    sectionHeading("IV.3.3 - Notification des Cas de Tuberculose"),
    tbTable(data.tuberculosis.notifications, "Classification"),
    sectionHeading("IV.3.4 - Résultats du Traitement Antituberculeux"),
    tbTable(data.tuberculosis.outcomes, "Issue du traitement"),
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
