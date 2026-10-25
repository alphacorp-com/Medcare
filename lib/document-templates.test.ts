import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DOCUMENT_TEMPLATE_SETTINGS,
  normalizeDocumentTemplateSettings,
  parseDocumentTemplateSettings,
  templateTexts,
} from "./document-templates";

const valid = { showLogo: true, digitalSignature: false, watermark: true, footerText: "", templates: {} };

test("accepts a complete settings object and trims texts", () => {
  const result = parseDocumentTemplateSettings({
    ...valid,
    footerText: "  Ouvert 24h/24  ",
    templates: { invoices: { title: " Facture ", intro: "", closing: "Merci" } },
  });
  assert.ok(result.ok);
  assert.equal(result.value.footerText, "Ouvert 24h/24");
  assert.deepEqual(result.value.templates.invoices, { title: "Facture", intro: "", closing: "Merci" });
});

test("does not store a template left at its defaults", () => {
  const result = parseDocumentTemplateSettings({ ...valid, templates: { receipts: { title: "  ", intro: "", closing: "" } } });
  assert.ok(result.ok);
  assert.deepEqual(result.value.templates, {});
});

test("ignores the legacy includeQR flag", () => {
  const result = parseDocumentTemplateSettings({ ...valid, includeQR: true });
  assert.ok(result.ok);
  assert.equal("includeQR" in result.value, false);
});

test("rejects non-boolean flags, unknown templates and over-long texts", () => {
  assert.deepEqual(parseDocumentTemplateSettings({ ...valid, watermark: "yes" }), { ok: false, error: "invalid_watermark" });
  assert.deepEqual(parseDocumentTemplateSettings({ ...valid, templates: { evil: { title: "x" } } }), { ok: false, error: "unknown_template" });
  assert.deepEqual(
    parseDocumentTemplateSettings({ ...valid, templates: { invoices: { title: "x".repeat(81) } } }),
    { ok: false, error: "title_too_long" }
  );
  assert.deepEqual(parseDocumentTemplateSettings({ ...valid, footerText: 12 }), { ok: false, error: "invalid_footer_text" });
  assert.deepEqual(parseDocumentTemplateSettings(null), { ok: false, error: "invalid_body" });
  assert.deepEqual(parseDocumentTemplateSettings([]), { ok: false, error: "invalid_body" });
});

test("normalize falls back to defaults on nothing or malformed data", () => {
  assert.deepEqual(normalizeDocumentTemplateSettings(undefined), DEFAULT_DOCUMENT_TEMPLATE_SETTINGS);
  assert.deepEqual(normalizeDocumentTemplateSettings({}), DEFAULT_DOCUMENT_TEMPLATE_SETTINGS);
  const legacy = normalizeDocumentTemplateSettings({ showLogo: false, includeQR: true, templates: { bogus: {}, invoices: { title: 3 } } });
  assert.equal(legacy.showLogo, false);
  assert.deepEqual(legacy.templates, { invoices: { title: "", intro: "", closing: "" } });
});

test("templateTexts fills the defaults of a template without custom texts", () => {
  assert.deepEqual(templateTexts(DEFAULT_DOCUMENT_TEMPLATE_SETTINGS, "lab_results"), { title: "", intro: "", closing: "" });
});
