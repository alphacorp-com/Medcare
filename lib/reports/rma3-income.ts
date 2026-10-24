import type { ActivityTable } from "@/lib/reports/activity-rows";

// RMA3 VI.3 income from patient billing: the payments received in the month, split over the
// lines of their invoice in proportion to the line amounts, each line in an income rubric.
// Pure, unit-tested in rma3-income.test.ts.
//
// Rubric of a line: from its billing source (consultation → billet de cession, hospitalisation,
// delivery, laboratory exam, imaging, surgery, pharmacy), overridden by the « rubrique RMA3 »
// of the category of its medical act when set (certificates, stomatology, minor surgery,
// ultrasound / X-ray…). Pharmacy: capital = purchase cost of the units (average receipt unit
// cost of the article), profit = the rest; an article without a known cost counts in profit.
// Sub-totals add the rubrics entered on the monthly form (lib/rma3-manual).

export const INCOME_RUBRICS = [
  { code: "VI.3-003", label: "Billet de cession (consultations)" },
  { code: "VI.3-005", label: "Hospitalisation" },
  { code: "VI.3-006", label: "Certificat médical" },
  { code: "VI.3-007", label: "Certificat médico-légal" },
  { code: "VI.3-008", label: "Accouchement" },
  { code: "VI.3-009", label: "Laboratoire" },
  { code: "VI.3-010", label: "Échographie" },
  { code: "VI.3-011", label: "Radiographie standard" },
  { code: "VI.3-012", label: "Stomatologie" },
  { code: "VI.3-013", label: "Petite chirurgie" },
  { code: "VI.3-014", label: "Chirurgie" },
] as const;

// What a category of acts can be mapped to (Settings > Act categories).
export const CATEGORY_RUBRICS: readonly string[] = INCOME_RUBRICS.map((r) => r.code);

export function parseIncomeRubric(value: unknown): string | null | "invalid" {
  if (value === null || value === "" || value === undefined) return null;
  return typeof value === "string" && CATEGORY_RUBRICS.includes(value) ? value : "invalid";
}

export const PHARMACY_CAPITAL = "VI.3-019";
export const PHARMACY_PROFIT = "VI.3-020";
export const UNCLASSIFIED = "unclassified";

export interface IncomeLine {
  amount: number;
  // Rubric resolved by the loader, or "pharmacy" (split into capital / profit).
  rubric: string;
  // Pharmacy only: purchase cost of the units of the line (null when unknown).
  purchaseCost: number | null;
}

export interface IncomePayment {
  amount: number;
  lines: IncomeLine[];
}

// Source of a line → default rubric (before the act category override).
export function defaultRubric(sourceType: string, examType?: string | null): string {
  switch (sourceType) {
    case "consultation":
    case "antenatal_visit":
      return "VI.3-003";
    case "hospitalization":
      return "VI.3-005";
    case "delivery":
      return "VI.3-008";
    case "exam":
      return examType === "radiology" ? "VI.3-011" : "VI.3-009";
    case "surgery":
      return "VI.3-014";
    case "pharmacy_dispensation":
      return "pharmacy";
    default:
      return UNCLASSIFIED;
  }
}

// Amounts per rubric (FCFA, rounded to the unit).
export function allocateIncome(payments: readonly IncomePayment[]): Record<string, number> {
  const totals: Record<string, number> = {};
  const add = (rubric: string, amount: number) => (totals[rubric] = (totals[rubric] ?? 0) + amount);
  for (const payment of payments) {
    const invoiceTotal = payment.lines.reduce((sum, l) => sum + Math.max(0, l.amount), 0);
    if (invoiceTotal <= 0) {
      add(UNCLASSIFIED, payment.amount);
      continue;
    }
    for (const line of payment.lines) {
      if (line.amount <= 0) continue;
      const share = (payment.amount * line.amount) / invoiceTotal;
      if (line.rubric !== "pharmacy") {
        add(line.rubric, share);
        continue;
      }
      // The share of the line's purchase cost that this payment covers.
      const capital = line.purchaseCost === null ? 0 : Math.min(share, (line.purchaseCost * share) / line.amount);
      add(PHARMACY_CAPITAL, capital);
      add(PHARMACY_PROFIT, share - capital);
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.round(v)]));
}

// The VI.3 table: billing rubrics, pharmacy, unclassified, and the three sub-totals with the
// rubrics of the monthly form (`manual`: code → FCFA amount entered).
export function buildIncomeTable(totals: Record<string, number>, manual: Record<string, number>): ActivityTable {
  const value = (code: string) => totals[code] ?? manual[code] ?? 0;
  const sum = (codes: string[]) => codes.reduce((s, c) => s + value(c), 0);
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `VI.3-${String(from + i).padStart(3, "0")}`);
  const fixed = (code: string, label: string, total: number) => ({ code, label, cells: {}, total });
  return {
    section: "VI.3",
    title: "Recettes du mois issues de la facturation (FCFA)",
    columns: [],
    rows: [
      ...INCOME_RUBRICS.map((r) => fixed(r.code, r.label, totals[r.code] ?? 0)),
      fixed(PHARMACY_CAPITAL, "Pharmacie / capital (coût d'achat)", totals[PHARMACY_CAPITAL] ?? 0),
      fixed(PHARMACY_PROFIT, "Pharmacie / bénéfice", totals[PHARMACY_PROFIT] ?? 0),
      fixed("VI.3-021", "Sous-total contributions locales (VI.3-003 à 020)", sum(range(3, 20))),
      fixed("VI.3-025", "Sous-total appuis extérieurs (VI.3-022 à 024)", sum(range(22, 24))),
      fixed("VI.3-029", "Sous-total recouvrement divers (VI.3-026 à 028)", sum(range(26, 28))),
      fixed("VI.3-NC", "Encaissements non classés (lignes sans rubrique)", totals[UNCLASSIFIED] ?? 0),
    ],
    note:
      "Encaissements du mois répartis au prorata des lignes de leur facture. Rubrique selon la source de la ligne ou la « rubrique RMA3 » de la catégorie d'actes (Paramètres > Catégories d'actes). " +
      "Pharmacie : capital = coût d'achat moyen des articles (réceptions), bénéfice = le reste. Sous-totaux : avec les rubriques saisies au formulaire mensuel.",
  };
}
