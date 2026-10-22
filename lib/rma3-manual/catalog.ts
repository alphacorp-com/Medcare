// The RMA3 indicators that no transaction of the app records (community activity,
// awareness sessions, supervisions, working environment, income and expenses outside
// patient billing): entered once a month on the RMA3 monthly form. Codes and labels follow
// the RMA3 indicator dictionary (Dictionnaire_Indicateurs_RMA3_Medcare.xlsx).
//
// The dictionary reuses VI.3-001…014 for the expenses after the income rows: the expenses
// are stored as VI.3-D001…D014 so the two lists never collide.
//
// The income rows the billing will produce (billet de cession, hospitalisation, laboratory,
// surgery, pharmacy… — chantier C22) and the VI.3 sub-totals are deliberately not here.
// Changing a code orphans the values already entered under it: add codes, never rename.

export type Rma3ValueKind = "count" | "amount" | "days" | "yesNo";

export type Rma3Breakdown = "none" | "plannedHeld" | "mother" | "sex" | "adolescentSex" | "malaria" | "infant" | "iptRank";

export interface Rma3ManualIndicator {
  code: string;
  label: string;
  kind: Rma3ValueKind;
  breakdown: Rma3Breakdown;
}

export interface Rma3ManualSection {
  code: string;
  title: string;
  indicators: Rma3ManualIndicator[];
}

export interface Rma3BreakdownColumn {
  key: string;
  label: string;
}

const sexes = (prefix: string, label: string): Rma3BreakdownColumn[] => [
  { key: `${prefix}_M`, label: `${label} M` },
  { key: `${prefix}_F`, label: `${label} F` },
];

// The cells of each breakdown, in the order of the form. "" is the single cell of a row
// without breakdown.
export const BREAKDOWN_COLUMNS: Readonly<Record<Rma3Breakdown, readonly Rma3BreakdownColumn[]>> = {
  none: [{ key: "", label: "Valeur" }],
  plannedHeld: [
    { key: "planned", label: "Planifiées" },
    { key: "held", label: "Réalisées" },
  ],
  mother: [
    { key: "age10to14", label: "10-14 ans" },
    { key: "age15to19", label: "15-19 ans" },
    { key: "age20plus", label: "> 19 ans" },
  ],
  sex: [
    { key: "M", label: "M" },
    { key: "F", label: "F" },
  ],
  adolescentSex: [...sexes("age10to14", "10-14 ans"), ...sexes("age15to19", "15-19 ans"), ...sexes("age20to24", "20-24 ans")],
  malaria: [...sexes("under5", "< 5 ans"), ...sexes("over5", "5 ans et +"), { key: "pregnant", label: "Femmes enceintes" }],
  infant: [
    { key: "age0to11m", label: "0-11 mois" },
    { key: "age12to24m", label: "12-24 mois" },
  ],
  iptRank: [
    { key: "rank1", label: "TPI1" },
    { key: "rank2", label: "TPI2" },
    { key: "rank3", label: "TPI3" },
    { key: "rank4plus", label: "TPI4+" },
  ],
};

const i = (code: string, label: string, breakdown: Rma3Breakdown = "none", kind: Rma3ValueKind = "count"): Rma3ManualIndicator => ({
  code,
  label,
  kind,
  breakdown,
});

const yesNo = (code: string, label: string) => i(code, label, "none", "yesNo");
const days = (code: string, label: string) => i(code, label, "none", "days");
const amount = (code: string, label: string) => i(code, label, "none", "amount");

export const RMA3_MANUAL_SECTIONS: readonly Rma3ManualSection[] = [
  {
    code: "II.1.2",
    title: "Accouchements dans la communauté",
    indicators: [
      i("II.1.2-002", "Total accouchements enregistrés dans la communauté", "mother"),
      i("II.1.2-016", "Décès maternels enregistrés (communauté)", "mother"),
      i("II.1.2-026", "Femmes (communauté) ayant initié l'allaitement dans les 30 min post-partum", "mother"),
    ],
  },
  {
    code: "II.1.4",
    title: "Naissances dans la communauté",
    indicators: [
      i("II.1.4-002", "Naissances vivantes enregistrées (communauté)", "sex"),
      i("II.1.4-024", "Décès néonataux (0-28 j) survenus en communauté", "sex"),
    ],
  },
  {
    code: "II.1.5",
    title: "Planification familiale en communauté",
    indicators: [i("II.1.5-005", "DMPA-SC (Sayana Press) distribué par les ASC")],
  },
  {
    code: "III.1",
    title: "Activités de communication et recherche des perdus de vue (PEV)",
    indicators: [
      i("III.1-003", "Causeries éducatives (séance fixe)", "plannedHeld"),
      i("III.1-004", "Causeries éducatives (séance avancée)", "plannedHeld"),
      i("III.1-005", "Réunions de sensibilisation vaccination villages / quartiers", "plannedHeld"),
      i("III.1-006", "Sensibilisations dans les écoles", "plannedHeld"),
      i("III.1-007", "Visites à domicile intégrant la vaccination", "plannedHeld"),
      i("III.1-008", "Visites / réunions de plaidoyer", "plannedHeld"),
      i("III.1-009", "Recherche des perdus de vue 0-11 mois", "plannedHeld"),
      i("III.1-010", "Recherche des perdus de vue 12-23 mois", "plannedHeld"),
      i("III.1-011", "Recherche des perdus de vue 24-59 mois", "plannedHeld"),
    ],
  },
  {
    code: "III.4",
    title: "Déchets de vaccination",
    indicators: [i("III.4-007", "Boîtes de sécurité utilisées"), i("III.4-008", "Boîtes de sécurité détruites")],
  },
  {
    code: "III.8",
    title: "Santé des adolescentes (milieu scolaire)",
    indicators: [i("III.8-004", "Adolescent(e)s supplémenté(e)s en fer / acide folique en milieu scolaire", "adolescentSex")],
  },
  {
    code: "IV.2.1",
    title: "TPI des femmes enceintes en communauté",
    indicators: [i("IV.2.1-003", "Femmes enceintes ayant reçu le TPI en communauté", "iptRank")],
  },
  {
    code: "IV.2.2-3",
    title: "Paludisme : communication",
    indicators: [
      i("IV.2.2-3-002", "Ménages visités"),
      i("IV.2.2-3-003", "Personnes sensibilisées (visites à domicile)"),
      i("IV.2.2-3-004", "Matériels imprimés distribués"),
      i("IV.2.2-3-005", "Séances IEC/CCC planifiées"),
      i("IV.2.2-3-006", "Séances IEC/CCC réalisées"),
      i("IV.2.2-3-007", "Personnes sensibilisées (IEC/CCC)"),
    ],
  },
  {
    code: "IV.2.4-5",
    title: "Paludisme : activité des agents de santé communautaires (ASC)",
    indicators: [
      i("IV.2.4-5-011", "Personnes reçues par les ASC", "malaria"),
      i("IV.2.4-5-012", "Cas de fièvre identifiés en communauté", "malaria"),
      i("IV.2.4-5-013", "Cas suspects reçus par les ASC", "malaria"),
      i("IV.2.4-5-014", "Cas suspects simples avec TDR", "malaria"),
      i("IV.2.4-5-015", "Cas simples confirmés par les ASC (TDR)", "malaria"),
      i("IV.2.4-5-016", "Cas graves confirmés par les ASC (TDR)", "malaria"),
      i("IV.2.4-5-017", "Cas graves TDR+ référés par les ASC", "malaria"),
      i("IV.2.4-5-018", "Cas graves TDR+ ayant reçu le traitement de pré-référence (artésunate suppositoire)", "malaria"),
      i("IV.2.4-5-049", "Cas simples confirmés traités par les ASC (ASAQ)", "malaria"),
      i("IV.2.4-5-050", "Cas simples confirmés traités par les ASC (AL)", "malaria"),
      i("IV.2.4-5-051", "Personnes référées à la FOSA par les ASC", "malaria"),
      i("IV.2.4-5-052", "Suspects simples TDR+ référés par les ASC (manque d'ACT)", "malaria"),
      i("IV.2.4-5-053", "Suspects graves TDR+ référés par les ASC et contre-référés", "malaria"),
    ],
  },
  {
    code: "IV.2.6",
    title: "TPIn des nourrissons en communauté",
    indicators: [
      i("IV.2.6-001", "TPIn1 en communauté", "infant"),
      i("IV.2.6-002", "TPIn2 en communauté", "infant"),
      i("IV.2.6-003", "TPIn3 en communauté", "infant"),
      i("IV.2.6-004", "TPIn4 en communauté", "infant"),
      i("IV.2.6-005", "TPIn5+ en communauté", "infant"),
      i("IV.2.6-006", "TPIn5 en communauté", "infant"),
      i("IV.2.6-007", "TPIn7+ en communauté", "infant"),
      i("IV.2.6-008", "TPIn8+ en communauté", "infant"),
    ],
  },
  {
    code: "IV.4.5",
    title: "Diabète / HTA : communication et dépistage communautaire",
    indicators: [
      i("IV.4.5-001", "Mobilisations sociales diabète / HTA"),
      i("IV.4.5-002", "Causeries éducatives diabète / HTA"),
      i("IV.4.5-003", "Personnes dépistées lors des causeries"),
      i("IV.4.5-004", "Visites à domicile réalisées"),
      i("IV.4.5-005", "Personnes dépistées pour le diabète en visite à domicile"),
      i("IV.4.5-006", "Personnes dépistées pour l'HTA en visite à domicile"),
      i("IV.4.5-007", "Personnes dépistées lors des mobilisations"),
    ],
  },
  {
    code: "V.10",
    title: "Participation communautaire",
    indicators: [
      i("V.10-001", "Supervisions de la pharmacie communautaire par le comité de gestion"),
      i("V.10-002", "Réunions du comité de gestion tenues"),
    ],
  },
  {
    code: "VI.1",
    title: "Environnement de travail",
    indicators: [
      yesNo("VI.1-001", "Point d'eau potable fonctionnel"),
      yesNo("VI.1-002", "Produits de potabilisation de l'eau"),
      yesNo("VI.1-003", "Dispositif de lavage des mains fonctionnel"),
      yesNo("VI.1-004", "Source d'énergie disponible"),
      yesNo("VI.1-005", "Connexion internet disponible"),
      yesNo("VI.1-006", "Ordinateur fonctionnel disponible"),
      yesNo("VI.1-007", "Dispositif de gestion des déchets fonctionnel"),
      yesNo("VI.1-008", "Toilettes fonctionnelles"),
    ],
  },
  {
    code: "VI.2",
    title: "Supervisions",
    indicators: [
      i("VI.2-001", "Supervisions internes planifiées"),
      i("VI.2-002", "Supervisions internes effectuées"),
      i("VI.2-003", "Supervisions reçues du niveau district"),
      i("VI.2-004", "Supervisions reçues du niveau régional"),
      i("VI.2-005", "Supervisions reçues du niveau central"),
    ],
  },
  {
    code: "VI.3-R",
    title: "Recettes du mois hors facturation des patients (FCFA)",
    indicators: [
      amount("VI.3-001", "Solde du mois précédent"),
      amount("VI.3-002", "Salaire payé directement par l'État"),
      amount("VI.3-004", "Carnet de santé"),
      amount("VI.3-015", "Acupuncture / kinésithérapie"),
      amount("VI.3-016", "Morgue"),
      amount("VI.3-017", "Activités génératrices de revenus"),
      amount("VI.3-018", "Médecine du travail"),
      amount("VI.3-022", "Subventions / subsides de l'État (BIP / BF / CSU)"),
      amount("VI.3-023", "Subventions / subsides des partenaires"),
      amount("VI.3-024", "Autres contributions (FINEX, dons, legs)"),
      amount("VI.3-026", "Retraits du compte bancaire (réserves)"),
      amount("VI.3-027", "Emprunts"),
      amount("VI.3-028", "Remboursement de prêts / avances"),
    ],
  },
  {
    code: "VI.3-D",
    title: "Dépenses du mois (FCFA)",
    indicators: [
      amount("VI.3-D001", "Salaires payés par l'État"),
      amount("VI.3-D002", "Salaires payés par la FOSA"),
      amount("VI.3-D003", "Indemnités fixes et cotisations"),
      amount("VI.3-D004", "Fonds de solidarité"),
      amount("VI.3-D005", "Paiement sous contrat"),
      amount("VI.3-D006", "Médicaments et réactifs de laboratoire"),
      amount("VI.3-D007", "Investissements"),
      amount("VI.3-D008", "Fonctionnement (eau, électricité, fournitures)"),
      amount("VI.3-D009", "Provision de réserves"),
      amount("VI.3-D010", "Marketing social"),
      amount("VI.3-D011", "Autres dépenses (dons, legs)"),
      amount("VI.3-D012", "Remboursement de dettes / emprunts"),
      amount("VI.3-D013", "Prêts / avances"),
      amount("VI.3-D014", "Primes / gratifications"),
    ],
  },
  {
    code: "VI.4",
    title: "Fonctionnalité de l'hôpital",
    indicators: [
      i("VI.4-001", "Réunions du comité d'hygiène hospitalière"),
      days("VI.4-002", "Jours de non-fonctionnalité de l'incinérateur"),
      days("VI.4-003", "Jours de non-fonctionnalité de la station d'épuration"),
      days("VI.4-004", "Jours de non-fonctionnalité de l'ambulance"),
      days("VI.4-005", "Jours de non-fonctionnalité du groupe électrogène"),
      days("VI.4-006", "Jours de non-fonctionnalité du service mortuaire"),
      days("VI.4-007", "Jours de non-fonctionnalité de l'oxygène"),
    ],
  },
  {
    code: "VI.6",
    title: "Patrimoine",
    indicators: [
      yesNo("VI.6-001", "FOSA construite selon les normes"),
      yesNo("VI.6-002", "FOSA réhabilitée"),
      yesNo("VI.6-003", "FOSA équipée (forage)"),
      yesNo("VI.6-004", "FOSA équipée (matériels médicaux / biomédicaux)"),
      yesNo("VI.6-005", "FOSA équipée (plaques solaires)"),
      yesNo("VI.6-006", "FOSA équipée (incinérateurs)"),
      yesNo("VI.6-007", "FOSA équipée (autres équipements)"),
    ],
  },
];

export const RMA3_MANUAL_INDICATORS: ReadonlyMap<string, Rma3ManualIndicator> = new Map(
  RMA3_MANUAL_SECTIONS.flatMap((s) => s.indicators).map((indicator) => [indicator.code, indicator])
);
