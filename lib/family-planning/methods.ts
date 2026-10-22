// Contraceptive methods offered in family planning (RMA3 II.1.5).
//
// Source: MINSANTE national protocol, section 1.1.3 « Méthodes contraceptives » (printed pages
// 29-30), as provided by the project lead. The protocol lists the methods by category, not as
// the « 16 méthodes » of the RMA3 form: this list may differ from the official form and must
// be checked against it. Codes are stored on FamilyPlanningVisit.methodCode: add codes, never
// rename one (the visits already recorded would lose their method).

export type FpMethodCategory = "natural" | "hormonal" | "barrier" | "intrauterine" | "surgical";

export interface FpMethod {
  code: string;
  label: string;
  category: FpMethodCategory;
  // Can be started after a delivery (RMA3 II.1.5-007, « 7 méthodes post-partum »).
  postpartum: boolean;
  // Long-acting / permanent: a procedure (insertion, surgery) goes with it.
  procedure: "implant" | "iud" | "surgery" | null;
}

export const FP_CATEGORY_LABELS: Record<FpMethodCategory, string> = {
  natural: "Méthodes naturelles",
  hormonal: "Méthodes hormonales",
  barrier: "Méthodes barrières",
  intrauterine: "Méthodes intra-utérines",
  surgical: "Méthodes chirurgicales",
};

export const FP_METHODS: readonly FpMethod[] = [
  { code: "billings", label: "Méthode Billings (glaire cervicale)", category: "natural", postpartum: false, procedure: null },
  { code: "temperature", label: "Méthode des températures", category: "natural", postpartum: false, procedure: null },
  { code: "symptothermal", label: "Méthode sympto-thermique", category: "natural", postpartum: false, procedure: null },
  { code: "calendar", label: "Méthode du calendrier / rythme", category: "natural", postpartum: false, procedure: null },
  { code: "standard_days", label: "Méthode des jours fixes (collier du cycle)", category: "natural", postpartum: false, procedure: null },
  { code: "lam", label: "MAMA (allaitement maternel et aménorrhée)", category: "natural", postpartum: true, procedure: null },
  { code: "coc", label: "Contraceptifs oraux combinés", category: "hormonal", postpartum: false, procedure: null },
  { code: "pop", label: "Pilules progestatives", category: "hormonal", postpartum: true, procedure: null },
  { code: "injectable", label: "Injectables progestatifs", category: "hormonal", postpartum: true, procedure: null },
  { code: "implant", label: "Implants", category: "hormonal", postpartum: true, procedure: "implant" },
  { code: "male_condom", label: "Préservatif masculin", category: "barrier", postpartum: true, procedure: null },
  { code: "female_condom", label: "Préservatif féminin", category: "barrier", postpartum: false, procedure: null },
  { code: "diaphragm", label: "Diaphragme", category: "barrier", postpartum: false, procedure: null },
  { code: "spermicide", label: "Spermicides", category: "barrier", postpartum: false, procedure: null },
  { code: "iud", label: "Dispositif intra-utérin (DIU)", category: "intrauterine", postpartum: true, procedure: "iud" },
  { code: "tubal_ligation", label: "Ligature des trompes", category: "surgical", postpartum: true, procedure: "surgery" },
  { code: "vasectomy", label: "Vasectomie", category: "surgical", postpartum: false, procedure: "surgery" },
];

export const FP_METHODS_BY_CODE: ReadonlyMap<string, FpMethod> = new Map(FP_METHODS.map((m) => [m.code, m]));

// Methods only a woman / only a man can use (the others: either).
export const FEMALE_ONLY_METHODS: ReadonlySet<string> = new Set(["lam", "coc", "pop", "injectable", "implant", "female_condom", "diaphragm", "iud", "tubal_ligation"]);
export const MALE_ONLY_METHODS: ReadonlySet<string> = new Set(["vasectomy"]);

// Which procedures go with which method (insertion / removal of an implant or an IUD).
export const PROCEDURE_METHOD: Record<"implant_insertion" | "implant_removal" | "iud_insertion" | "iud_removal", "implant" | "iud"> = {
  implant_insertion: "implant",
  implant_removal: "implant",
  iud_insertion: "iud",
  iud_removal: "iud",
};
