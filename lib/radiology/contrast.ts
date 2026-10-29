// French and English terms that point to a contrast-medium allergy (iodinated or gadolinium),
// including the shellfish allergy often recorded as a proxy. Compared without case or accents,
// as whole words or word prefixes ("iod" matches iode, iodé, iodine…).
const CONTRAST_ALLERGY_TERMS = [
  "iod", // iode, iodé(e), iodine, iodinated
  "contrast", // contrast, contraste
  "gadolin", // gadolinium
  "pdc", // produit de contraste
  "shellfish",
  "fruits de mer",
  "crustace", // crustacé(s)
  "coquillage",
];

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Heuristic, non-blocking safety check: does any of the patient's free-text allergy entries
 * mention a contrast-related term? Intentionally a warning, not a hard block — a match against
 * free text is not a reliable enough signal to override clinical judgment either way.
 */
export function findContrastAllergyMatches(allergies: string[]): string[] {
  return allergies.filter((allergy) => {
    const text = normalize(allergy);
    return CONTRAST_ALLERGY_TERMS.some((term) => new RegExp(`(^|[^a-z])${term}`).test(text));
  });
}
