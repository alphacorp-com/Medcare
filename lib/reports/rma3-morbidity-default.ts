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

export type Rma3MorbiditySection = "II.2" | "III.7" | "IV.4" | "IV.4A" | "IV.4.9" | "IV.4.10" | "IV.4.11" | "IV.5";

// How a section breaks its counts down (RMA3 form columns). Ages are at the consultation date.
export type Rma3Breakdown = "none" | "sex" | "under5" | "under5Sex" | "mentalAgeSex" | "eyeAge" | "eyeAgeSex";

export interface Rma3MorbiditySectionConfig {
  section: Rma3MorbiditySection;
  title: string;
  breakdown: Rma3Breakdown;
  // Also count coded causes of death in a "Décès" column (sections whose form has one).
  countDeaths: boolean;
}

export const RMA3_MORBIDITY_SECTIONS: readonly Rma3MorbiditySectionConfig[] = [
  { section: "II.2", title: "Cancers génésiques et fistules", breakdown: "none", countDeaths: false },
  { section: "III.7", title: "PCIMNE (enfants de 0-59 mois)", breakdown: "under5", countDeaths: false },
  { section: "IV.4", title: "Maladies non transmissibles", breakdown: "sex", countDeaths: true },
  { section: "IV.4A", title: "Asthme", breakdown: "under5Sex", countDeaths: true },
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
  ],
};

// Rows of the RMA3 form that a coded diagnosis cannot produce: printed in the report so the
// reader knows they are not computed (they need the modules listed in the RMA3 dictionary).
export const RMA3_NOT_DERIVABLE: Record<Rma3MorbiditySection, string[]> = {
  "II.2": [
    "Femmes de 30-49 ans dépistées (cancer du col)",
    "Cas suspectés, pris en charge et référés (sein, col)",
    "Fistules pris en charge / référées ; cancer de la prostate pris en charge / référé",
  ],
  "III.7": ["Enfants ayant reçu SRO / SRO + zinc", "Pneumonies traitées par antibiotique", "Enfants pris en charge selon l'approche PCIMNE"],
  "IV.4": [
    "Cirrhose et cancer du foie post-hépatite B, B-Delta et C (croisement de diagnostics)",
    "Mutilations génitales féminines, harcèlement sexuel (pas de catégorie CIM-10 dédiée)",
  ],
  "IV.4A": ["Désagrégation des décès par âge et sexe (le total des décès est produit)"],
  "IV.4.9": ["Cas référés"],
  "IV.4.10": ["Cataracte opérée", "Trachome compliqué (trichiasis)"],
  "IV.4.11": ["Cophose (non distinguable de la surdité au niveau catégorie)", "Actes : extraction, soins conservateurs, pulpectomie, détartrage, dévitalisation"],
  "IV.5": ["Catégories de l'ulcère de Buruli et grades de la lèpre", "Formes de la filariose et de la schistosomiase (sous-codes CIM-10 non importés)"],
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
