import type { ExamParameterDefinition } from "@/lib/exam-catalog/parameters";

// Standard result sheets for the exams shipped in the catalog, keyed by ExamCatalogEntry.code.
// Used by the reference-data seed and by `npm run db:sync-exam-parameters`, which applies
// them to tenants' existing catalog entries.
//
// References follow WHO guidance where it exists, and otherwise usual adult reference
// intervals (French-speaking lab practice, SI units). A lab must check them against its own
// analysers and reagents and adjust them in Settings → Exam types.
//   - Haemoglobin / anaemia: WHO, Haemoglobin concentrations for the diagnosis of anaemia
//     and assessment of severity (VMNIS, 2011; severe anaemia < 7 g/dL).
//   - Glycaemia: WHO/IDF, Definition and diagnosis of diabetes mellitus (2006) — fasting
//     ≥ 7.0 mmol/L = diabetes, 6.1–6.9 = impaired fasting glucose.
//   - Malaria: WHO, Basic malaria microscopy (2010) and Guidelines for malaria (severe
//     malaria / hyperparasitaemia > 10 %).
//   - Tuberculosis: WHO consolidated guidelines, module 3 (Xpert MTB/RIF result categories)
//     and the WHO/IUATLD AFB smear grading scale.
//   - HIV: WHO consolidated guidelines on HIV testing services (serial testing strategy).
//   - Urine culture: significant bacteriuria ≥ 10⁵ CFU/mL, leukocyturia ≥ 10/mm³ (10⁴/mL).
//   - Critical (panic) values: common laboratory alert thresholds.

const NEG_POS = ["Négatif", "Positif"];
const REACTIVE = ["Non réactif", "Réactif"];
const ABSENT_PRESENT = ["Absent(e)s", "Présent(e)s"];
const CROSSES = ["Négatif", "Traces", "+", "++", "+++"];

export const LAB_PARAMETERS: Record<string, ExamParameterDefinition[]> = {
  // ── Hématologie ───────────────────────────────────────────────────────────
  CBC: [
    { section: "Lignée blanche", name: "Globules blancs (leucocytes)", unit: "10³/µL", referenceRange: "4,0 – 10,0", low: 4.0, high: 10.0, criticalLow: 2.0, criticalHigh: 30.0 },
    { section: "Lignée blanche", name: "Polynucléaires neutrophiles", unit: "10³/µL", referenceRange: "1,5 – 7,0 (1,0 possible : neutropénie ethnique bénigne)", low: 1.5, high: 7.0, criticalLow: 0.5 },
    { section: "Lignée blanche", name: "Lymphocytes", unit: "10³/µL", referenceRange: "1,0 – 4,0", low: 1.0, high: 4.0 },
    { section: "Lignée blanche", name: "Monocytes", unit: "10³/µL", referenceRange: "0,2 – 1,0", low: 0.2, high: 1.0 },
    { section: "Lignée blanche", name: "Polynucléaires éosinophiles", unit: "10³/µL", referenceRange: "0,0 – 0,5", low: 0, high: 0.5 },
    { section: "Lignée blanche", name: "Polynucléaires basophiles", unit: "10³/µL", referenceRange: "0,0 – 0,1", low: 0, high: 0.1 },
    {
      section: "Lignée rouge", name: "Globules rouges (hématies)", unit: "10⁶/µL", referenceRange: "H : 4,5 – 5,9 / F : 4,0 – 5,2",
      bySex: { M: { referenceRange: "4,5 – 5,9", low: 4.5, high: 5.9 }, F: { referenceRange: "4,0 – 5,2", low: 4.0, high: 5.2 } },
    },
    {
      section: "Lignée rouge", name: "Hémoglobine", unit: "g/dL", referenceRange: "H : ≥ 13,0 / F : ≥ 12,0 / grossesse : ≥ 11,0 (OMS)",
      bySex: { M: { referenceRange: "13,0 – 17,0", low: 13.0, high: 17.0 }, F: { referenceRange: "12,0 – 16,0", low: 12.0, high: 16.0 } },
      criticalLow: 7.0, criticalHigh: 20.0,
    },
    {
      section: "Lignée rouge", name: "Hématocrite", unit: "%", referenceRange: "H : 40 – 52 / F : 36 – 48",
      bySex: { M: { referenceRange: "40 – 52", low: 40, high: 52 }, F: { referenceRange: "36 – 48", low: 36, high: 48 } },
      criticalLow: 20, criticalHigh: 60,
    },
    { section: "Lignée rouge", name: "VGM (volume globulaire moyen)", unit: "fL", referenceRange: "80 – 100", low: 80, high: 100 },
    { section: "Lignée rouge", name: "TCMH (teneur corpusculaire moyenne en Hb)", unit: "pg", referenceRange: "27 – 32", low: 27, high: 32 },
    { section: "Lignée rouge", name: "CCMH (concentration corpusculaire moyenne en Hb)", unit: "g/dL", referenceRange: "32 – 36", low: 32, high: 36 },
    { section: "Plaquettes", name: "Plaquettes", unit: "10³/µL", referenceRange: "150 – 400", low: 150, high: 400, criticalLow: 20, criticalHigh: 1000 },
  ],

  // ── Biochimie ─────────────────────────────────────────────────────────────
  CMP: [
    { section: "Glycémie", name: "Glycémie à jeun", unit: "mmol/L", referenceRange: "3,9 – 6,1 (diabète si ≥ 7,0 — OMS)", low: 3.9, high: 6.1, criticalLow: 2.2, criticalHigh: 22.0 },
    { section: "Fonction rénale", name: "Urée", unit: "mmol/L", referenceRange: "2,5 – 7,5", low: 2.5, high: 7.5, criticalHigh: 35 },
    {
      section: "Fonction rénale", name: "Créatinine", unit: "µmol/L", referenceRange: "H : 62 – 106 / F : 44 – 80",
      bySex: { M: { referenceRange: "62 – 106", low: 62, high: 106 }, F: { referenceRange: "44 – 80", low: 44, high: 80 } },
      criticalHigh: 500,
    },
    { section: "Ionogramme", name: "Sodium (Na⁺)", unit: "mmol/L", referenceRange: "135 – 145", low: 135, high: 145, criticalLow: 120, criticalHigh: 160 },
    { section: "Ionogramme", name: "Potassium (K⁺)", unit: "mmol/L", referenceRange: "3,5 – 5,0", low: 3.5, high: 5.0, criticalLow: 2.5, criticalHigh: 6.5 },
    { section: "Ionogramme", name: "Chlorures (Cl⁻)", unit: "mmol/L", referenceRange: "98 – 107", low: 98, high: 107 },
    { section: "Ionogramme", name: "Bicarbonates (HCO₃⁻)", unit: "mmol/L", referenceRange: "22 – 29", low: 22, high: 29, criticalLow: 10, criticalHigh: 40 },
    { section: "Ionogramme", name: "Calcium total", unit: "mmol/L", referenceRange: "2,15 – 2,55", low: 2.15, high: 2.55, criticalLow: 1.6, criticalHigh: 3.5 },
    { section: "Protéines", name: "Protéines totales", unit: "g/L", referenceRange: "64 – 83", low: 64, high: 83 },
    { section: "Protéines", name: "Albumine", unit: "g/L", referenceRange: "35 – 50", low: 35, high: 50 },
    {
      section: "Bilan hépatique", name: "ASAT (TGO)", unit: "UI/L", referenceRange: "H : < 40 / F : < 35",
      bySex: { M: { referenceRange: "< 40", high: 40 }, F: { referenceRange: "< 35", high: 35 } },
    },
    {
      section: "Bilan hépatique", name: "ALAT (TGP)", unit: "UI/L", referenceRange: "H : < 45 / F : < 35",
      bySex: { M: { referenceRange: "< 45", high: 45 }, F: { referenceRange: "< 35", high: 35 } },
    },
    { section: "Bilan hépatique", name: "Bilirubine totale", unit: "µmol/L", referenceRange: "< 21", high: 21, criticalHigh: 340 },
    { section: "Bilan hépatique", name: "Phosphatases alcalines", unit: "UI/L", referenceRange: "40 – 130", low: 40, high: 130 },
  ],
  LIPID: [
    { name: "Cholestérol total", unit: "mmol/L", referenceRange: "< 5,2", high: 5.2 },
    { name: "LDL-cholestérol", unit: "mmol/L", referenceRange: "< 3,4 (cible selon le risque cardiovasculaire)", high: 3.4 },
    {
      name: "HDL-cholestérol", unit: "mmol/L", referenceRange: "H : > 1,0 / F : > 1,3",
      bySex: { M: { referenceRange: "> 1,0", low: 1.0 }, F: { referenceRange: "> 1,3", low: 1.3 } },
    },
    { name: "Triglycérides", unit: "mmol/L", referenceRange: "< 1,7", high: 1.7, criticalHigh: 11.3 },
  ],
  "TROP-I": [
    { name: "Troponine I", unit: "ng/mL", referenceRange: "< 0,04 (99ᵉ percentile — selon la technique)", high: 0.04, criticalHigh: 0.4 },
  ],

  // ── Urines — ECBU ─────────────────────────────────────────────────────────
  UA: [
    { section: "Examen macroscopique", name: "Aspect", unit: "", referenceRange: "Limpide", options: ["Limpide", "Légèrement trouble", "Trouble", "Hématique"], normalOptions: ["Limpide"] },
    { section: "Examen macroscopique", name: "Couleur", unit: "", referenceRange: "Jaune pâle à jaune citrin", options: ["Jaune pâle", "Jaune citrin", "Jaune foncé", "Ambrée", "Rouge / brune"], normalOptions: ["Jaune pâle", "Jaune citrin"] },
    { section: "Bandelette urinaire", name: "pH", unit: "", referenceRange: "5,0 – 8,0", low: 5.0, high: 8.0 },
    { section: "Bandelette urinaire", name: "Densité", unit: "", referenceRange: "1,005 – 1,030", low: 1.005, high: 1.03 },
    { section: "Bandelette urinaire", name: "Protéines", unit: "", referenceRange: "Négatif", options: CROSSES, normalOptions: ["Négatif", "Traces"] },
    { section: "Bandelette urinaire", name: "Glucose", unit: "", referenceRange: "Négatif", options: CROSSES, normalOptions: ["Négatif"] },
    { section: "Bandelette urinaire", name: "Corps cétoniques", unit: "", referenceRange: "Négatif", options: CROSSES, normalOptions: ["Négatif"] },
    { section: "Bandelette urinaire", name: "Sang (hémoglobine)", unit: "", referenceRange: "Négatif", options: CROSSES, normalOptions: ["Négatif"] },
    { section: "Bandelette urinaire", name: "Nitrites", unit: "", referenceRange: "Négatif", options: NEG_POS, normalOptions: ["Négatif"] },
    { section: "Bandelette urinaire", name: "Leucocytes (estérase)", unit: "", referenceRange: "Négatif", options: CROSSES, normalOptions: ["Négatif"] },
    { section: "Cytologie", name: "Leucocytes", unit: "/mm³", referenceRange: "< 10 (leucocyturie si ≥ 10/mm³ = 10⁴/mL)", low: 0, high: 10 },
    { section: "Cytologie", name: "Hématies", unit: "/mm³", referenceRange: "< 10", low: 0, high: 10 },
    { section: "Cytologie", name: "Cellules épithéliales", unit: "", referenceRange: "Rares", options: ["Absentes", "Rares", "Quelques", "Nombreuses"], normalOptions: ["Absentes", "Rares", "Quelques"] },
    { section: "Cytologie", name: "Cylindres", unit: "", referenceRange: "Absents", options: ["Absents", "Hyalins", "Granuleux", "Leucocytaires", "Hématiques"], normalOptions: ["Absents", "Hyalins"] },
    { section: "Cytologie", name: "Cristaux", unit: "", referenceRange: "Absents", options: ["Absents", "Oxalate de calcium", "Acide urique", "Phosphates", "Autres"], normalOptions: ["Absents"] },
    { section: "Cytologie", name: "Levures", unit: "", referenceRange: "Absentes", options: ABSENT_PRESENT, normalOptions: ["Absent(e)s"] },
    { section: "Cytologie", name: "Trichomonas vaginalis", unit: "", referenceRange: "Absent", options: ABSENT_PRESENT, normalOptions: ["Absent(e)s"] },
    { section: "Bactériologie", name: "Examen direct (coloration de Gram)", unit: "", referenceRange: "Absence de germes", options: ["Absence de germes", "Bacilles Gram négatif", "Cocci Gram positif", "Flore polymorphe"], normalOptions: ["Absence de germes"] },
    { section: "Bactériologie", name: "Uroculture — bactériurie", unit: "UFC/mL", referenceRange: "< 10³ (significative si ≥ 10⁵)", low: 0, high: 1000 },
    { section: "Bactériologie", name: "Germe identifié", unit: "", referenceRange: "—" },
    { section: "Bactériologie", name: "Antibiogramme", unit: "", referenceRange: "—" },
  ],

  // ── Sérologie ─────────────────────────────────────────────────────────────
  HIV: [
    { name: "Test 1 (dépistage)", unit: "", referenceRange: "Non réactif", options: REACTIVE, normalOptions: ["Non réactif"] },
    { name: "Test 2 (si test 1 réactif)", unit: "", referenceRange: "Non réalisé / Non réactif", options: ["Non réalisé", ...REACTIVE], normalOptions: ["Non réalisé", "Non réactif"] },
    { name: "Test 3 (si tests 1 et 2 réactifs)", unit: "", referenceRange: "Non réalisé / Non réactif", options: ["Non réalisé", ...REACTIVE], normalOptions: ["Non réalisé", "Non réactif"] },
    { name: "Conclusion (stratégie OMS)", unit: "", referenceRange: "Négatif", options: ["Négatif", "Positif", "Indéterminé — à refaire dans 14 jours"], normalOptions: ["Négatif"] },
  ],
  SYPH: [
    { name: "RPR / VDRL", unit: "", referenceRange: "Non réactif", options: REACTIVE, normalOptions: ["Non réactif"] },
    { name: "Titre RPR", unit: "", referenceRange: "—" },
    { name: "TPHA / test tréponémique", unit: "", referenceRange: "Négatif", options: NEG_POS, normalOptions: ["Négatif"] },
  ],

  // ── Parasitologie ─────────────────────────────────────────────────────────
  "MALARIA-TDR": [
    {
      name: "TDR paludisme", unit: "", referenceRange: "Négatif",
      options: ["Négatif", "Positif P. falciparum (HRP2)", "Positif Pan (pLDH)", "Positif mixte (HRP2 + pLDH)", "Invalide — à refaire"],
      normalOptions: ["Négatif"],
    },
  ],
  "MALARIA-GE": [
    { name: "Goutte épaisse", unit: "", referenceRange: "Négatif", options: NEG_POS, normalOptions: ["Négatif"] },
    { name: "Espèce (frottis mince)", unit: "", referenceRange: "—", options: ["—", "P. falciparum", "P. malariae", "P. ovale", "P. vivax", "Infection mixte"], normalOptions: ["—"] },
    { name: "Densité parasitaire", unit: "parasites/µL", referenceRange: "0 (paludisme grave si > 10 % d'hématies parasitées ≈ 500 000/µL — OMS)", low: 0, high: 0, criticalHigh: 500000 },
    { name: "Gamétocytes", unit: "", referenceRange: "Absents", options: ABSENT_PRESENT, normalOptions: ["Absent(e)s"] },
  ],

  // ── Bactériologie — Tuberculose ───────────────────────────────────────────
  "TB-GENEXPERT": [
    {
      name: "MTB (complexe Mycobacterium tuberculosis)", unit: "", referenceRange: "Non détecté",
      options: ["Non détecté", "Détecté — traces", "Détecté — très faible", "Détecté — faible", "Détecté — moyen", "Détecté — élevé", "Invalide / erreur — à refaire"],
      normalOptions: ["Non détecté"],
    },
    {
      name: "Résistance à la rifampicine", unit: "", referenceRange: "Non détectée",
      options: ["Non applicable", "Non détectée", "Détectée", "Indéterminée"],
      normalOptions: ["Non applicable", "Non détectée"],
      criticalOptions: ["Détectée"],
    },
  ],
  "TB-MICROSCOPY": [
    ...["Échantillon 1", "Échantillon 2"].map((name) => ({
      name: `BAAR — ${name}`,
      unit: "",
      referenceRange: "Négatif",
      options: ["Négatif (0 BAAR / 100 champs)", "Rares (1 – 9 BAAR / 100 champs)", "1+ (10 – 99 BAAR / 100 champs)", "2+ (1 – 10 BAAR / champ)", "3+ (> 10 BAAR / champ)"],
      normalOptions: ["Négatif (0 BAAR / 100 champs)"],
    })),
  ],
};

// For imaging, the "reference" is the normal finding and the result is what the
// radiographer observes; measurable items carry their usual upper/lower limits.
const NORMAL = "Normal";

export const RADIOLOGY_PARAMETERS: Record<string, ExamParameterDefinition[]> = {
  "XR-CHEST": [
    { name: "Qualité technique (inspiration, pénétration, rotation)", unit: "", referenceRange: "Satisfaisante" },
    { name: "Parenchyme pulmonaire", unit: "", referenceRange: "Transparence normale, pas d'opacité ni de nodule" },
    { name: "Hiles pulmonaires", unit: "", referenceRange: NORMAL },
    { name: "Index cardio-thoracique", unit: "", referenceRange: "< 0,50", high: 0.5 },
    { name: "Médiastin", unit: "", referenceRange: "Non élargi, trachée médiane" },
    { name: "Coupoles diaphragmatiques", unit: "", referenceRange: "Régulières, bien positionnées" },
    { name: "Culs-de-sac costo-diaphragmatiques", unit: "", referenceRange: "Libres" },
    { name: "Plèvre", unit: "", referenceRange: "Pas d'épanchement ni de pneumothorax" },
    { name: "Cadre osseux et parties molles", unit: "", referenceRange: NORMAL },
  ],
  "XR-EXT": [
    { name: "Segment et incidences réalisées", unit: "", referenceRange: "—" },
    { name: "Corticales", unit: "", referenceRange: "Continues, pas de trait de fracture" },
    { name: "Alignement / rapports articulaires", unit: "", referenceRange: "Respectés" },
    { name: "Interlignes articulaires", unit: "", referenceRange: "Conservés" },
    { name: "Densité et structure osseuse", unit: "", referenceRange: NORMAL },
    { name: "Parties molles", unit: "", referenceRange: "Pas de tuméfaction ni de corps étranger" },
  ],
  "CT-HEAD": [
    { name: "Parenchyme cérébral", unit: "", referenceRange: "Densité normale, différenciation substance blanche / grise conservée" },
    { name: "Hémorragie intracrânienne", unit: "", referenceRange: "Absente", options: ["Absente", "Présente"], normalOptions: ["Absente"], criticalOptions: ["Présente"] },
    { name: "Déviation de la ligne médiane", unit: "mm", referenceRange: "0", low: 0, high: 0, criticalHigh: 5 },
    { name: "Système ventriculaire", unit: "", referenceRange: "Taille et morphologie normales" },
    { name: "Citernes de la base", unit: "", referenceRange: "Libres" },
    { name: "Fosse postérieure", unit: "", referenceRange: NORMAL },
    { name: "Boîte crânienne", unit: "", referenceRange: "Pas de fracture" },
    { name: "Sinus et cellules mastoïdiennes", unit: "", referenceRange: "Bien aérés" },
  ],
  "CT-ABD-CONTRAST": [
    { name: "Foie", unit: "", referenceRange: "Taille et rehaussement normaux, pas de lésion focale" },
    { name: "Voies biliaires", unit: "", referenceRange: "Non dilatées" },
    { name: "Vésicule biliaire", unit: "", referenceRange: "Paroi fine, pas de lithiase" },
    { name: "Pancréas", unit: "", referenceRange: NORMAL },
    { name: "Rate — grand axe", unit: "cm", referenceRange: "< 12", high: 12 },
    { name: "Reins et voies excrétrices", unit: "", referenceRange: "Pas d'hydronéphrose ni de lithiase" },
    { name: "Surrénales", unit: "", referenceRange: NORMAL },
    { name: "Tube digestif", unit: "", referenceRange: "Pas d'épaississement pariétal ni d'occlusion" },
    { name: "Pneumopéritoine", unit: "", referenceRange: "Absent", options: ["Absent", "Présent"], normalOptions: ["Absent"], criticalOptions: ["Présent"] },
    { name: "Épanchement péritonéal", unit: "", referenceRange: "Absent", options: ["Absent", "Faible abondance", "Moyenne abondance", "Grande abondance"], normalOptions: ["Absent"] },
    { name: "Adénopathies", unit: "", referenceRange: "Absentes (petit axe < 10 mm)" },
    { name: "Aorte abdominale — diamètre", unit: "mm", referenceRange: "< 30", high: 30, criticalHigh: 55 },
    { name: "Vessie et organes pelviens", unit: "", referenceRange: NORMAL },
  ],
  "CT-CHEST-CONTRAST": [
    { name: "Parenchyme pulmonaire", unit: "", referenceRange: "Pas de condensation, de masse ni de verre dépoli" },
    { name: "Nodules pulmonaires", unit: "", referenceRange: "Absents" },
    { name: "Arbre trachéo-bronchique", unit: "", referenceRange: "Perméable" },
    { name: "Artères pulmonaires", unit: "", referenceRange: "Pas de défect endoluminal", options: ["Pas de défect endoluminal", "Embolie pulmonaire"], normalOptions: ["Pas de défect endoluminal"], criticalOptions: ["Embolie pulmonaire"] },
    { name: "Aorte thoracique — diamètre", unit: "mm", referenceRange: "< 40", high: 40, criticalHigh: 55 },
    { name: "Médiastin et ganglions", unit: "", referenceRange: "Pas d'adénopathie (petit axe < 10 mm)" },
    { name: "Plèvre", unit: "", referenceRange: "Pas d'épanchement ni de pneumothorax" },
    { name: "Péricarde", unit: "", referenceRange: "Pas d'épanchement" },
    { name: "Paroi thoracique et squelette", unit: "", referenceRange: NORMAL },
  ],
  "MRI-BRAIN": [
    { name: "Signal du parenchyme cérébral", unit: "", referenceRange: NORMAL },
    { name: "Diffusion", unit: "", referenceRange: "Pas de restriction", options: ["Pas de restriction", "Restriction (lésion ischémique récente)"], normalOptions: ["Pas de restriction"], criticalOptions: ["Restriction (lésion ischémique récente)"] },
    { name: "Substance blanche", unit: "", referenceRange: "Pas d'hypersignal pathologique" },
    { name: "Système ventriculaire", unit: "", referenceRange: "Taille normale" },
    { name: "Ligne médiane", unit: "", referenceRange: "En place" },
    { name: "Fosse postérieure et tronc cérébral", unit: "", referenceRange: NORMAL },
    { name: "Région sellaire / hypophyse", unit: "", referenceRange: NORMAL },
  ],
  "MRI-SPINE-CONTRAST": [
    { name: "Courbures / alignement", unit: "", referenceRange: "Physiologiques" },
    { name: "Corps vertébraux", unit: "", referenceRange: "Hauteur et signal normaux" },
    { name: "Disques intervertébraux", unit: "", referenceRange: "Pas de hernie ni de protrusion" },
    { name: "Canal rachidien — diamètre antéro-postérieur", unit: "mm", referenceRange: "≥ 12 (canal étroit si < 10)", low: 10 },
    { name: "Moelle épinière / cône terminal", unit: "", referenceRange: "Signal normal" },
    { name: "Foramens", unit: "", referenceRange: "Libres" },
    { name: "Prise de contraste", unit: "", referenceRange: "Pas de prise de contraste pathologique" },
  ],
  "US-ABD": [
    { name: "Foie — flèche hépatique (ligne médioclaviculaire)", unit: "cm", referenceRange: "< 15,5", high: 15.5 },
    { name: "Foie — échostructure", unit: "", referenceRange: "Homogène, contours réguliers" },
    { name: "Vésicule biliaire — paroi", unit: "mm", referenceRange: "< 3", high: 3 },
    { name: "Vésicule biliaire — contenu", unit: "", referenceRange: "Anéchogène, pas de lithiase" },
    { name: "Voie biliaire principale", unit: "mm", referenceRange: "< 6", high: 6 },
    { name: "Pancréas", unit: "", referenceRange: NORMAL },
    { name: "Rate — grand axe", unit: "cm", referenceRange: "< 12", high: 12 },
    { name: "Rein droit — grand axe", unit: "cm", referenceRange: "10 – 12", low: 9, high: 13 },
    { name: "Rein gauche — grand axe", unit: "cm", referenceRange: "10 – 12,5", low: 9, high: 13 },
    { name: "Cavités pyélocalicielles", unit: "", referenceRange: "Non dilatées" },
    { name: "Aorte abdominale — diamètre", unit: "mm", referenceRange: "< 30", high: 30, criticalHigh: 55 },
    { name: "Épanchement péritonéal", unit: "", referenceRange: "Absent", options: ["Absent", "Faible abondance", "Moyenne abondance", "Grande abondance"], normalOptions: ["Absent"] },
  ],
  "US-PELVIS": [
    { name: "Vessie", unit: "", referenceRange: "Paroi fine, contenu anéchogène" },
    { name: "Utérus — position et dimensions", unit: "", referenceRange: "Antéversé, longueur 6 – 9 cm (nullipare)" },
    { name: "Endomètre — épaisseur", unit: "mm", referenceRange: "Selon la phase du cycle ; < 5 après la ménopause" },
    { name: "Myomètre", unit: "", referenceRange: "Homogène, pas de myome" },
    { name: "Ovaire droit", unit: "", referenceRange: NORMAL },
    { name: "Ovaire gauche", unit: "", referenceRange: NORMAL },
    { name: "Cul-de-sac de Douglas", unit: "", referenceRange: "Libre", options: ["Libre", "Épanchement de faible abondance", "Épanchement abondant"], normalOptions: ["Libre"] },
    { name: "Prostate — volume (homme)", unit: "mL", referenceRange: "< 30", high: 30 },
    { name: "Résidu post-mictionnel", unit: "mL", referenceRange: "< 50", high: 50 },
  ],
  "MMG-SCREEN": [
    { name: "Densité mammaire (ACR)", unit: "", referenceRange: "Type A ou B", options: ["A — graisseuse", "B — fibroglandulaire dispersée", "C — hétérogène dense", "D — extrêmement dense"], normalOptions: ["A — graisseuse", "B — fibroglandulaire dispersée"] },
    { name: "Masse / opacité", unit: "", referenceRange: "Absente" },
    { name: "Microcalcifications", unit: "", referenceRange: "Absentes ou d'allure bénigne" },
    { name: "Distorsion architecturale", unit: "", referenceRange: "Absente" },
    { name: "Asymétrie de densité", unit: "", referenceRange: "Absente" },
    { name: "Ganglions axillaires", unit: "", referenceRange: NORMAL },
    {
      name: "Classification BI-RADS (ACR)", unit: "", referenceRange: "1 ou 2",
      options: ["0 — examen incomplet", "1 — normal", "2 — bénin", "3 — probablement bénin", "4 — suspect", "5 — fortement évocateur de malignité", "6 — malignité prouvée"],
      normalOptions: ["1 — normal", "2 — bénin"],
      criticalOptions: ["5 — fortement évocateur de malignité", "6 — malignité prouvée"],
    },
  ],
};
