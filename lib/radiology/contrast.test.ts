import { test } from "node:test";
import assert from "node:assert/strict";
import { findContrastAllergyMatches } from "./contrast";

test("French and English contrast allergy wordings are detected", () => {
  for (const allergy of ["Allergie à l'iode", "IODE", "Produit de contraste iodé", "PDC", "Gadolinium", "Fruits de mer", "Crustacés", "coquillages", "Iodine", "contrast media", "shellfish"]) {
    assert.deepEqual(findContrastAllergyMatches([allergy]), [allergy], allergy);
  }
});

test("unrelated allergies are not flagged", () => {
  for (const allergy of ["Pénicilline", "Arachide", "Aspirine", "Latex", "Période de grossesse"]) {
    assert.deepEqual(findContrastAllergyMatches([allergy]), [], allergy);
  }
});
