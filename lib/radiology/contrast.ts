const CONTRAST_ALLERGY_KEYWORDS = ["iodine", "contrast", "gadolinium", "shellfish"];

/**
 * Heuristic, non-blocking safety check: does any of the patient's free-text
 * allergy entries mention a contrast-related keyword? This is intentionally a
 * warning, not a hard block — a keyword match against free text is not a
 * reliable enough signal to override clinical judgment either way.
 */
export function findContrastAllergyMatches(allergies: string[]): string[] {
  return allergies.filter((allergy) =>
    CONTRAST_ALLERGY_KEYWORDS.some((keyword) => allergy.toLowerCase().includes(keyword))
  );
}
