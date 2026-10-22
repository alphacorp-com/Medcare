// RMA3 morbidity sections fed by coded diagnoses: cancers (II.2), PCIMNE (III.7),
// non-communicable diseases (IV.4, asthma, mental health IV.4.9, eye IV.4.10, oral/ENT
// IV.4.11) and neglected tropical diseases (IV.5).
//
// Unlike the cause tables V.3-V.5 (one principal diagnosis → one cause), these sections
// count NEW CASES: every consultation diagnosis (principal or secondary) flagged "new case"
// is counted in EVERY active rubric that covers its code, so overlapping rows such as
// "Cirrhose (total)" and its sub-rows can coexist.
//
// PROPOSAL TO BE VALIDATED BY THE MEDICAL TEAM, like the cause tables. The shipped ICD-10
// catalog only holds 3-character categories, so rows that the RMA3 splits below that level
// (Buruli categories, leprosy grades, schistosomiasis urinary vs intestinal…) are merged
// into one row, and rows that a single code cannot express (treatments, referrals, acts,
// "suspected" / "taken in charge" statuses, cross-diagnoses such as cirrhosis after
// hepatitis B) are listed in RMA3_NOT_DERIVABLE instead of being approximated.

export type Rma3MorbiditySection = "II.2" | "III.7" | "IV.4" | "IV.4A" | "IV.4.1" | "IV.4.4" | "IV.4.9" | "IV.4.10" | "IV.4.11" | "IV.5";

// How a section breaks its counts down (RMA3 form columns). Ages are at the consultation date.
export type Rma3Breakdown = "none" | "sex" | "under5" | "under5Sex" | "diabetesSex" | "hypertensionSex" | "mentalAgeSex" | "eyeAge" | "eyeAgeSex";

export interface Rma3MorbiditySectionConfig {
  section: Rma3MorbiditySection;
  title: string;
  breakdown: Rma3Breakdown;
  // Also count coded causes of death in a "Décès" column (sections whose form has one).
  countDeaths: boolean;
  // The form breaks the deaths down like the new cases (age at death × sex).
  deathsByColumn?: boolean;
}

export const RMA3_MORBIDITY_SECTIONS: readonly Rma3MorbiditySectionConfig[] = [
  { section: "II.2", title: "Cancers génésiques et fistules", breakdown: "none", countDeaths: false },
  { section: "III.7", title: "PCIMNE (enfants de 0-59 mois)", breakdown: "under5", countDeaths: false },
  { section: "IV.4", title: "Maladies non transmissibles", breakdown: "sex", countDeaths: true },
  { section: "IV.4A", title: "Asthme", breakdown: "under5Sex", countDeaths: true },
  { section: "IV.4.1", title: "Diabète (type 1 / type 2)", breakdown: "diabetesSex", countDeaths: true, deathsByColumn: true },
  { section: "IV.4.4", title: "Hypertension artérielle : personnes diagnostiquées", breakdown: "hypertensionSex", countDeaths: false },
  { section: "IV.4.9", title: "Santé mentale", breakdown: "mentalAgeSex", countDeaths: false },
  { section: "IV.4.10", title: "Troubles visuels chroniques", breakdown: "eyeAge", countDeaths: false },
  { section: "IV.4.11", title: "Affections bucco-dentaires et auditives", breakdown: "eyeAgeSex", countDeaths: false },
  { section: "IV.5", title: "Maladies tropicales négligées", breakdown: "none", countDeaths: false },
];

type Entry = [label: string, ranges: string];

const ROWS: Record<Rma3MorbiditySection, Entry[]> = {
  "II.2": [
    ["Cas de cancer du sein confirmés", "C50"],
    ["Cas de cancer du col confirmés", "C53"],
    ["Cas de fistules (génitales, dont obstétricales) dépistés", "N82"],
    ["Cas de cancer de la prostate diagnostiqués", "C61"],
  ],
  "III.7": [
    ["Cas de diarrhée", "A00-A09"],
    ["Enfants souffrant de pneumonie", "J12-J18"],
  ],
  "IV.4": [
    ["Épilepsie", "G40-G41"],
    ["Traumatismes", "S00-T14"],
    ["Obésité (IMC ≥ 30)", "E66"],
    ["Viols", "Y05"],
    ["Maigreur (IMC ≤ 16)", "E41, E43"],
    ["Hydrocéphalies", "G91, Q03"],
    ["Accidents de la voie publique", "V01-V89"],
    ["Pied-bot / malformations du pied de l'enfant", "Q66"],
    ["Affections rhumatismales", "M00-M25"],
    ["Malnutrition chronique", "E44-E46"],
    ["Cirrhose (total)", "K70, K74"],
    ["Cancer du foie (total)", "C22"],
    ["Grosse prostate", "N40"],
    ["Masse du sein", "N63"],
    ["Saignements post-ménopausiques", "N95"],
    ["Écoulement anormal du sein", "N64"],
    ["Drépanocytose", "D57"],
    ["Infirmités motrices cérébrales", "G80"],
    ["Ulcère gastrique", "K25-K27"],
    ["Violence du partenaire intime", "Y07"],
  ],
  "IV.4A": [["Asthme (nouveaux cas / décès)", "J45-J46"]],
  "IV.4.1": [
    ["Diabète de type 1", "E10"],
    ["Diabète de type 2", "E11"],
  ],
  "IV.4.4": [["Personnes diagnostiquées HTA (nouveaux cas)", "I10-I15"]],
  "IV.4.9": [
    ["Première consultation de santé mentale (tout trouble F00-F99)", "F00-F99"],
    ["Dépression", "F32-F33"],
    ["Psychose", "F20-F29"],
    ["Accès maniaque (trouble bipolaire)", "F30-F31"],
    ["Consommation de drogue et troubles liés", "F11-F16, F18-F19"],
    ["Consommation d'alcool et troubles liés", "F10"],
    ["Troubles neuro-développementaux", "F70-F89"],
    ["Troubles de conduite (TDAH…)", "F90-F92"],
    ["Troubles émotionnels graves", "F93"],
    ["Démence (Alzheimer…)", "F00-F03, G30"],
    ["Traumatisme mental (SSPT)", "F43"],
    ["Transe (troubles de conversion / somatoformes)", "F44-F45"],
  ],
  "IV.4.10": [
    ["Glaucome", "H40-H42"],
    ["Cataracte (nouveaux cas)", "H25-H26"],
    ["Opacités cornéennes", "H17"],
    ["Onchocercose", "B73"],
    ["Avitaminose A", "E50"],
    ["Trachome (phase aiguë)", "A71"],
    ["Vices de réfraction", "H52"],
    ["Rétinopathie diabétique", "H36"],
    ["Tumeur oculaire / orbitaire", "C69, D31"],
    ["Cécité / malvoyance", "H54"],
    ["Trachome compliqué (trichiasis)", "H02.0, B94.0"],
  ],
  "IV.4.11": [
    ["Carie dentaire", "K02"],
    ["Maladies parodontales", "K05"],
    ["Affections du pharynx", "J02, J39"],
    ["Tumeurs bénignes ORL", "D10"],
    ["Tumeurs malignes ORL", "C00-C14, C30-C32"],
    ["Otite chronique", "H66"],
    ["Traumatisme maxillo-facial", "S02"],
    ["Baisse de l'audition", "H91"],
    ["Surdité", "H90"],
  ],
  "IV.5": [
    ["Trachome (phase aiguë)", "A71"],
    ["Ulcère de Buruli (toutes catégories)", "A31"],
    ["Filariose lymphatique (toutes formes)", "B74"],
    ["Schistosomiase (urinaire et intestinale)", "B65"],
    ["Helminthiases intestinales", "B76-B82"],
    ["Lèpre (toutes formes)", "A30"],
    ["Ver de Guinée", "B72"],
    ["Pian", "A66"],
    ["Scabiose (gale)", "B86"],
    ["Leishmaniose (cutanée et viscérale)", "B55"],
    ["Tungose (chique)", "B88"],
    ["Trypanosomiase humaine africaine", "B56"],
    ["Complications de morsures de serpent", "X20"],
    ["Varicelle", "B01"],
    ["Fièvre éruptive", "B09"],
    // Sub-codes (WHO ICD-10, added to the catalog): the rows above stay as totals.
    ["Trachome compliqué (trichiasis)", "H02.0, B94.0"],
    ["Schistosomiase urinaire", "B65.0"],
    ["Schistosomiase intestinale", "B65.1, B65.2"],
    ["Leishmaniose cutanée", "B55.1, B55.2"],
    ["Leishmaniose viscérale", "B55.0"],
    ["Lèpre paucibacillaire (toutes)", "A30.0, A30.1, A30.2"],
    ["Lèpre multibacillaire (toutes)", "A30.3, A30.4, A30.5"],
  ],
};

// Rows of the RMA3 form that a coded diagnosis cannot produce: printed in the report so the
// reader knows they are not computed (they need the modules listed in the RMA3 dictionary).
export const RMA3_NOT_DERIVABLE: Record<Rma3MorbiditySection, string[]> = {
  "II.2": ["Dépistage du col, cas suspectés, pris en charge et référés : tableau « Cancers : suspicion, prise en charge, référence » (diagnostics suspectés, séjours transférés, actes)"],
  "III.7": ["SRO, SRO + zinc, antibiotique : tableau « PCIMNE : traitements » ; enfants pris en charge selon l'approche PCIMNE (module PCIMNE à venir)"],
  "IV.4": ["Mutilations génitales féminines, harcèlement sexuel : formulaire mensuel RMA3 (pas de catégorie CIM-10 dédiée)"],
  "IV.4A": ["Désagrégation des décès par âge et sexe (le total des décès est produit)"],
  "IV.4.1": [],
  "IV.4.4": [],
  "IV.4.9": ["Cas référés : tableau « Santé mentale : cas référés »"],
  "IV.4.10": ["Cataracte opérée : tableau des actes (acte rattaché à l'indicateur dans Paramètres > Actes médicaux)"],
  "IV.4.11": ["Cophose : formulaire mensuel RMA3", "Actes dentaires : tableau des actes (Paramètres > Actes médicaux)"],
  "IV.5": ["Catégories de l'ulcère de Buruli, grades de la lèpre, formes de la filariose : formulaire mensuel RMA3"],
};

export interface DefaultMorbidityRubric {
  section: Rma3MorbiditySection;
  code: string;
  label: string;
  icd10Ranges: string;
  order: number;
  isActive: boolean;
}

export const DEFAULT_MORBIDITY_RUBRICS: readonly DefaultMorbidityRubric[] = RMA3_MORBIDITY_SECTIONS.flatMap(({ section }) =>
  ROWS[section].map(([label, icd10Ranges], index) => ({
    section,
    code: `RMA3-${section}-${String(index + 1).padStart(3, "0")}`,
    label,
    icd10Ranges,
    order: index + 1,
    isActive: true,
  }))
);

// The RMA3 form numbers asthma under IV.4 too; "IV.4A" only keeps its rubric codes apart
// from the other IV.4 rows. This gives the number printed on the report and in Settings.
export function rma3FormSection(section: string): string {
  return section === "IV.4A" ? "IV.4" : section;
}
