// The 35 staff cadres of the RMA3 (VI.5), in form order. Codes are stored on
// StaffMember.cadre: add codes, never rename one.

export interface StaffCadre {
  code: string;
  rma3Code: string;
  label: string;
}

const LABELS = [
  "Médecin généraliste",
  "Sage-femme / maïeuticien",
  "IDE généraliste / principal",
  "Infirmier supérieur",
  "IDE spécialiste ophtalmologie",
  "IDE spécialiste santé mentale",
  "IDE spécialiste anesthésie-réanimation",
  "IDE spécialiste gérontologie",
  "TMS option pharmacie",
  "TMS option prothèses dentaires",
  "TMS option analyses médicales",
  "TMS option imagerie / radiologie",
  "TMS option kinésithérapie",
  "TMS option soins dentaires",
  "TMS option optique / réfraction",
  "TMS option psychomotricité",
  "Aide-soignant généraliste",
  "Aide-soignant santé communautaire",
  "ATMS",
  "Ingénieur statisticien",
  "Ingénieur informaticien",
  "Comptable / régisseur / caissier",
  "Assistante sociale",
  "Diététicien",
  "Documentaliste",
  "Secrétaire",
  "Agent de maîtrise",
  "Brancardier",
  "Blanchisseur",
  "Agent d'entretien",
  "Chauffeur",
  "Cuisinier",
  "Jardinier",
  "Gardien",
  "Autres personnels",
];

export const STAFF_CADRES: readonly StaffCadre[] = LABELS.map((label, index) => {
  const n = String(index + 1).padStart(3, "0");
  return { code: `VI5_${n}`, rma3Code: `VI.5-${n}`, label };
});

export const STAFF_CADRES_BY_CODE: ReadonlyMap<string, StaffCadre> = new Map(STAFF_CADRES.map((c) => [c.code, c]));
