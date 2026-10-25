// Settings of the printed documents (Settings > Document templates): global branding, plus
// per-template texts the facility can edit. Pure, unit-tested in document-templates.test.ts.
// Stored as the "document_templates" TenantSetting; the route validates with
// parseDocumentTemplateSettings, the print sites read with normalizeDocumentTemplateSettings.

export const DOCUMENT_TEMPLATE_IDS = [
  "invoices",
  "receipts",
  "insurance_claims",
  "prescriptions",
  "medications",
  "lab_results",
  "patient_lists",
  "patient_files",
  "medical_record",
  "stock_reports",
] as const;
export type DocumentTemplateId = (typeof DOCUMENT_TEMPLATE_IDS)[number];

// Empty string = the template's own default.
export type TemplateTexts = {
  title: string;
  intro: string;
  closing: string;
};

export type DocumentTemplateSettings = {
  showLogo: boolean;
  // A "signature and stamp" block at the end of every document.
  digitalSignature: boolean;
  watermark: boolean;
  // Line printed in every document's footer (legal mention, opening hours…).
  footerText: string;
  templates: Partial<Record<DocumentTemplateId, TemplateTexts>>;
};

export const TEMPLATE_TEXT_LIMITS = { title: 80, intro: 400, closing: 400, footerText: 300 } as const;

export const DEFAULT_DOCUMENT_TEMPLATE_SETTINGS: DocumentTemplateSettings = {
  showLogo: true,
  digitalSignature: false,
  watermark: true,
  footerText: "",
  templates: {},
};

export const EMPTY_TEMPLATE_TEXTS: TemplateTexts = { title: "", intro: "", closing: "" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isTemplateId = (v: string): v is DocumentTemplateId => (DOCUMENT_TEMPLATE_IDS as readonly string[]).includes(v);
const clean = (v: string) => v.replace(/\s+$/g, "").replace(/^\s+/g, "");

export type ParseResult = { ok: true; value: DocumentTemplateSettings } | { ok: false; error: string };

// Strict validation of a PUT body: every field is required and checked. Legacy keys the old
// form sent (includeQR) are ignored rather than rejected, so an open settings page keeps saving.
export function parseDocumentTemplateSettings(body: unknown): ParseResult {
  if (!isRecord(body)) return { ok: false, error: "invalid_body" };

  const flags = ["showLogo", "digitalSignature", "watermark"] as const;
  for (const flag of flags) {
    if (typeof body[flag] !== "boolean") return { ok: false, error: `invalid_${flag}` };
  }

  const footerText = body.footerText ?? "";
  if (typeof footerText !== "string" || clean(footerText).length > TEMPLATE_TEXT_LIMITS.footerText) {
    return { ok: false, error: "invalid_footer_text" };
  }

  const rawTemplates = body.templates ?? {};
  if (!isRecord(rawTemplates)) return { ok: false, error: "invalid_templates" };

  const templates: DocumentTemplateSettings["templates"] = {};
  for (const [id, texts] of Object.entries(rawTemplates)) {
    if (!isTemplateId(id)) return { ok: false, error: "unknown_template" };
    if (!isRecord(texts)) return { ok: false, error: "invalid_template_texts" };
    const parsed: TemplateTexts = { ...EMPTY_TEMPLATE_TEXTS };
    for (const field of ["title", "intro", "closing"] as const) {
      const value = texts[field] ?? "";
      if (typeof value !== "string") return { ok: false, error: `invalid_${field}` };
      const trimmed = clean(value);
      if (trimmed.length > TEMPLATE_TEXT_LIMITS[field]) return { ok: false, error: `${field}_too_long` };
      parsed[field] = trimmed;
    }
    // A template left entirely at its defaults is not stored.
    if (parsed.title || parsed.intro || parsed.closing) templates[id] = parsed;
  }

  return {
    ok: true,
    value: {
      showLogo: body.showLogo as boolean,
      digitalSignature: body.digitalSignature as boolean,
      watermark: body.watermark as boolean,
      footerText: clean(footerText),
      templates,
    },
  };
}

// Lenient read of whatever is stored (possibly written before this format, or nothing at all):
// defaults for anything missing or malformed, so a print never fails on old settings.
export function normalizeDocumentTemplateSettings(stored: unknown): DocumentTemplateSettings {
  const source = isRecord(stored) ? stored : {};
  const bool = (key: "showLogo" | "digitalSignature" | "watermark") =>
    typeof source[key] === "boolean" ? (source[key] as boolean) : DEFAULT_DOCUMENT_TEMPLATE_SETTINGS[key];

  const templates: DocumentTemplateSettings["templates"] = {};
  if (isRecord(source.templates)) {
    for (const [id, texts] of Object.entries(source.templates)) {
      if (!isTemplateId(id) || !isRecord(texts)) continue;
      const pick = (field: keyof TemplateTexts) =>
        typeof texts[field] === "string" ? (texts[field] as string).slice(0, TEMPLATE_TEXT_LIMITS[field]) : "";
      templates[id] = { title: pick("title"), intro: pick("intro"), closing: pick("closing") };
    }
  }

  return {
    showLogo: bool("showLogo"),
    digitalSignature: bool("digitalSignature"),
    watermark: bool("watermark"),
    footerText: typeof source.footerText === "string" ? source.footerText.slice(0, TEMPLATE_TEXT_LIMITS.footerText) : "",
    templates,
  };
}

// The texts of one template, defaults filled in.
export function templateTexts(settings: DocumentTemplateSettings, id: DocumentTemplateId): TemplateTexts {
  return { ...EMPTY_TEMPLATE_TEXTS, ...settings.templates[id] };
}
