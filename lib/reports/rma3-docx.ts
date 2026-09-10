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
import { Rma3KeyValueRow, Rma3MalariaRow, Rma3ReportData, Rma3TbRow, Rma3VaccinationRow } from "./rma3";

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
  "III.2 - Immunisation des Enfants (PEV)",
  "IV.2 - Lutte contre le Paludisme",
  "IV.3 - Notification et Résultats du Traitement Antituberculeux",
  "V.1 - Activité générale (consultations, hospitalisations, décès, capacité)",
];

const EXCLUDED_SECTIONS = [
  "III.5 Chaîne du froid / gestion des stocks vaccinaux",
  "IV.1.1 Dépistage VIH en population générale (hors grossesse)",
  "Registre / stock des médicaments antituberculeux",
  "V.6 Banque de sang / transfusion",
  "V.7 Stock des médicaments traceurs (40 lignes)",
  "V.8 Pharmacovigilance",
  "V.9 Oxygène médical",
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

function vaccinationTable(rows: Rma3VaccinationRow[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      "Antigène / Dose", "Garçons", "Filles", "Sexe non précisé", "Total",
      "< 12 mois", "12-23 mois", "24-59 mois", "5 ans et +", "Hors calendrier",
    ].map((text) => cell(text, { bold: true, shaded: true })),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: [
          cell(`${r.antigenName} (dose ${r.doseNumber})`),
          cell(String(r.boys)),
          cell(String(r.girls)),
          cell(String(r.unknownSex)),
          cell(String(r.total)),
          cell(String(r.ageUnder12m)),
          cell(String(r.age12to23m)),
          cell(String(r.age24to59m)),
          cell(String(r.age5yPlus)),
          cell(String(r.outOfSchedule)),
        ],
      })
  );
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
    sectionHeading("IV.2 - Lutte contre le Paludisme"),
    malariaTable(data.malaria),
    sectionHeading("IV.3.3 - Notification des Cas de Tuberculose"),
    tbTable(data.tuberculosis.notifications, "Classification"),
    sectionHeading("IV.3.4 - Résultats du Traitement Antituberculeux"),
    tbTable(data.tuberculosis.outcomes, "Issue du traitement"),
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
