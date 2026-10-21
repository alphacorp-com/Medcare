// Default ICD-10 correspondence of the RMA3 cause tables, used to seed each tenant's
// editable Rma3DiagnosisRubric rows (Settings > RMA3 : correspondance CIM-10).
//
// PROPOSAL TO BE VALIDATED BY THE MEDICAL TEAM: the ranges follow the usual ICD-10
// groupings of each cause; the facility's medical information officer should review them
// against the official MINSANTE guidance before relying on the RMA3 figures.
//
// Known limits:
//  - "Schistosomiase urinaire" is B65.0; the shipped ICD-10 catalog only holds 3-character
//    categories, so the whole B65 category is mapped until sub-codes are imported.
//  - The RMA3 reference dictionary lists two rubrics twice in V.4/V.5 (032 = 023 and
//    035 = 024); the duplicates are seeded inactive and empty so nothing is counted twice.

import { DEFAULT_MORBIDITY_RUBRICS, RMA3_MORBIDITY_SECTIONS, type Rma3MorbiditySection } from "./rma3-morbidity-default";

export type Rma3CauseSection = "V.3" | "V.4" | "V.5";
export type Rma3RubricSection = Rma3CauseSection | Rma3MorbiditySection;

export interface DefaultRubric {
  section: Rma3RubricSection;
  code: string;
  label: string;
  icd10Ranges: string;
  order: number;
  isActive: boolean;
}

export const RMA3_CAUSE_SECTIONS: Record<Rma3CauseSection, string> = {
  "V.3": "Principales causes de consultation",
  "V.4": "Principales causes d'hospitalisation",
  "V.5": "Principales causes de décès",
};

type Entry = [label: string, ranges: string, active?: boolean];

const CONSULTATION: Entry[] = [
  ["Paludisme", "B50-B54"],
  ["Helminthiases intestinales", "B76-B82"],
  ["Schistosomiase urinaire", "B65"],
  ["Affections aiguës des voies respiratoires supérieures", "J00-J06"],
  ["Affections aiguës des voies respiratoires inférieures", "J09-J22"],
  ["Maladies chroniques des voies respiratoires inférieures", "J40-J47"],
  ["Maladies intestinales infectieuses", "A00-A09"],
  ["Tuberculose", "A15-A19"],
  ["Mycoses", "B35-B49"],
  ["VIH", "B20-B24"],
  ["IST", "A50-A64"],
  ["Anémies nutritionnelles", "D50-D53"],
  ["Malnutrition", "E40-E46"],
  ["Diabète sucré", "E10-E14"],
  ["Maladies hypertensives", "I10-I15"],
  ["Maladies cérébrovasculaires", "I60-I69"],
  ["Cardiopathies ischémiques", "I20-I25"],
  ["Arthroses", "M15-M19"],
  ["Troubles mentaux et du comportement", "F00-F99"],
  ["Caries dentaires", "K02"],
  ["Gingivite et maladies périodontales", "K05"],
  ["Otalgie et écoulement de l'oreille", "H92"],
  ["Maladies de l'œsophage, de l'estomac et du duodénum", "K20-K31"],
  ["Maladies des organes génitaux de l'homme", "N40-N51"],
  ["Brûlures et corrosions", "T20-T32"],
  ["Intoxications par médicaments et substances", "T36-T65"],
  ["Lésions traumatiques", "S00-T14"],
];

// V.4 (hospitalization) and V.5 (death) share the same list of causes.
const HOSPITAL: Entry[] = [
  ["Accouchement", "O80-O84"],
  ["Complications du travail et de l'accouchement", "O60-O75"],
  ["Affections respiratoires et cardio-vasculaires de la période périnatale", "P20-P29"],
  ["Infections de la période périnatale", "P35-P39"],
  ["Affections hémorragiques et hématologiques du fœtus et du nouveau-né", "P50-P61"],
  ["Paludisme", "B50-B54"],
  ["Méningite bactérienne", "A39, G00"],
  ["Affections aiguës des voies respiratoires supérieures", "J00-J06"],
  ["Affections aiguës des voies respiratoires inférieures", "J09-J22"],
  ["Maladies chroniques des voies respiratoires inférieures", "J40-J47"],
  ["Maladies intestinales infectieuses", "A00-A09"],
  ["Tuberculose", "A15-A19"],
  ["VIH", "B20-B24"],
  ["Anémies nutritionnelles", "D50-D53"],
  ["Malnutrition", "E40-E46"],
  ["Diabète sucré", "E10-E14"],
  ["Maladies hypertensives", "I10-I15"],
  ["Maladies cérébrovasculaires", "I60-I69"],
  ["Cardiopathies ischémiques", "I20-I25"],
  ["Arthroses", "M15-M19"],
  ["Troubles mentaux", "F00-F99"],
  ["Otalgie et écoulement de l'oreille", "H92"],
  ["Maladies de l'œsophage, de l'estomac et du duodénum", "K20-K31"],
  ["Maladies des organes génitaux de l'homme", "N40-N51"],
  ["Brûlures et corrosions", "T20-T32"],
  ["Intoxications par médicaments et substances", "T36-T65"],
  ["Lésions traumatiques", "S00-T14"],
  ["Insuffisance rénale", "N17-N19"],
  ["Maladies du foie", "K70-K77"],
  ["Maladies du péritoine", "K65-K67"],
  ["Maladies de l'appendice", "K35-K38"],
  ["Maladies de l'œsophage, de l'estomac et du duodénum (doublon du dictionnaire)", "", false],
  ["Maladies de l'oreille moyenne et de l'apophyse mastoïde", "H65-H75"],
  ["Hernies", "K40-K46"],
  ["Maladies des organes génitaux de l'homme (doublon du dictionnaire)", "", false],
  ["Tumeurs malignes", "C00-C97"],
];

// Every editable section, in form order. "exclusive" sections count each diagnosis in one
// rubric only (first active match), so overlapping ranges there are a configuration error.
export const RMA3_RUBRIC_SECTIONS: readonly { section: Rma3RubricSection; title: string; exclusive: boolean }[] = [
  ...RMA3_MORBIDITY_SECTIONS.map(({ section, title }) => ({ section, title, exclusive: false })),
  ...(Object.keys(RMA3_CAUSE_SECTIONS) as Rma3CauseSection[]).map((section) => ({ section, title: RMA3_CAUSE_SECTIONS[section], exclusive: true })),
];

function build(section: Rma3CauseSection, entries: Entry[]): DefaultRubric[] {
  return entries.map(([label, icd10Ranges, isActive = true], index) => ({
    section,
    code: `RMA3-${section}-${String(index + 1).padStart(3, "0")}`,
    label,
    icd10Ranges,
    order: index + 1,
    isActive,
  }));
}

export const DEFAULT_RMA3_RUBRICS: readonly DefaultRubric[] = [
  ...build("V.3", CONSULTATION),
  ...build("V.4", HOSPITAL),
  ...build("V.5", HOSPITAL),
  ...DEFAULT_MORBIDITY_RUBRICS,
];
