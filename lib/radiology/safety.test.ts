import { test } from "node:test";
import assert from "node:assert/strict";
import { ageInYears, isIonizingModality, isValidViewerTemplate, newAccessionNumber, parseRadiationDose, parseSafetyCheck, safetyRequirements, viewerUrl } from "./safety";

const at = new Date("2026-10-29T10:00:00Z");
const actor = { userId: "u1", at };

test("ionizing modalities: ultrasound, MRI and ECG are not; unknown counts as ionizing", () => {
  assert.equal(isIonizingModality("xray"), true);
  assert.equal(isIonizingModality("ct_scan"), true);
  assert.equal(isIonizingModality("echo"), false);
  assert.equal(isIonizingModality("MRI"), false);
  assert.equal(isIonizingModality(null), true);
});

test("age is counted in full years", () => {
  assert.equal(ageInYears(new Date("2000-10-30"), at), 25);
  assert.equal(ageInYears(new Date("2000-10-29"), at), 26);
});

test("requirements: pregnancy for a woman of 10-55 and an ionizing exam; renal and allergy with contrast", () => {
  const base = { at, modality: "xray", requiresContrast: false, contrastAllergyMatches: [] };
  assert.equal(safetyRequirements({ ...base, gender: "F", birthDate: new Date("1996-01-01") }).pregnancy, true);
  assert.equal(safetyRequirements({ ...base, gender: "F", birthDate: new Date("1960-01-01") }).pregnancy, false, "over 55");
  assert.equal(safetyRequirements({ ...base, gender: "M", birthDate: new Date("1996-01-01") }).pregnancy, false);
  assert.equal(safetyRequirements({ ...base, gender: "F", birthDate: new Date("1996-01-01"), modality: "echo" }).pregnancy, false, "ultrasound");
  const contrast = safetyRequirements({ ...base, gender: "M", birthDate: new Date("1980-01-01"), requiresContrast: true, contrastAllergyMatches: ["Iode"] });
  assert.deepEqual(contrast, { pregnancy: false, renal: true, contrastAllergy: true });
});

test("safety check: a pregnant or unknown status needs a justification", () => {
  const req = { pregnancy: true, renal: false, contrastAllergy: false };
  assert.equal(parseSafetyCheck({ pregnancy: { status: "not_pregnant" } }, req, actor).ok, true);
  assert.deepEqual(parseSafetyCheck({ pregnancy: { status: "unknown" } }, req, actor), { ok: false, error: "pregnancy_justification_required" });
  assert.equal(parseSafetyCheck({ pregnancy: { status: "pregnant", justification: "Polytraumatisme, bénéfice vital" } }, req, actor).ok, true);
  assert.deepEqual(parseSafetyCheck({}, req, actor), { ok: false, error: "pregnancy_status_required" });
});

test("safety check: renal assessment and allergy acknowledgement with contrast", () => {
  const req = { pregnancy: false, renal: true, contrastAllergy: true };
  assert.deepEqual(parseSafetyCheck({ renal: { assessed: true }, contrastAllergyAcknowledged: false }, req, actor), { ok: false, error: "contrast_allergy_acknowledgement_required" });
  assert.deepEqual(parseSafetyCheck({ renal: {} , contrastAllergyAcknowledged: true }, req, actor), { ok: false, error: "renal_assessment_required" });
  assert.deepEqual(parseSafetyCheck({ renal: { assessed: true, egfr: "abc" }, contrastAllergyAcknowledged: true }, req, actor), { ok: false, error: "renal_values_invalid" });
  const ok = parseSafetyCheck({ renal: { assessed: true, creatinineUmolL: "88", egfr: 75 }, contrastAllergyAcknowledged: true, pregnancy: { status: "pregnant" } }, req, actor);
  assert.ok(ok.ok);
  assert.deepEqual(ok.value.renal, { assessed: true, creatinineUmolL: 88, egfr: 75 });
  assert.equal(ok.value.pregnancy, undefined, "answers not asked for are not kept");
});

test("radiation dose: optional numbers, refused when invalid", () => {
  assert.deepEqual(parseRadiationDose(undefined), { ok: true, value: null });
  assert.deepEqual(parseRadiationDose({ dapMgyCm2: "", ctdiVolMgy: null }), { ok: true, value: null });
  const ct = parseRadiationDose({ ctdiVolMgy: "12.5", dlpMgyCm: 450 });
  assert.ok(ct.ok && ct.value);
  assert.equal(ct.value?.ctdiVolMgy, 12.5);
  assert.equal(parseRadiationDose({ dlpMgyCm: -3 }).ok, false);
  assert.equal(parseRadiationDose({ fluoroscopySeconds: "abc" }).ok, false);
});

test("accession number and viewer link", () => {
  assert.equal(newAccessionNumber(at, () => 0.0123456), "A2610290123456");
  assert.equal(isValidViewerTemplate("https://pacs.local/ohif/viewer?AccessionNumber={accession}"), true);
  assert.equal(isValidViewerTemplate("javascript:alert({accession})"), false);
  assert.equal(isValidViewerTemplate("https://pacs.local/viewer"), false, "no placeholder");
  assert.equal(viewerUrl("https://pacs.local/v?acc={accession}", "A26 1"), "https://pacs.local/v?acc=A26%201");
  assert.equal(viewerUrl(null, "A1"), null);
});
