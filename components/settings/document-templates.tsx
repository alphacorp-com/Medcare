import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Printer, ShieldCheck, Eye, Pencil } from "lucide-react";
import { useState } from "react";
import { PDFPreviewModal } from "../templates/PDFPreviewModal";
import type { OrgData } from "./organization-settings";
import {
  TEMPLATE_TEXT_LIMITS,
  templateTexts,
  type DocumentTemplateId,
  type DocumentTemplateSettings,
  type TemplateTexts,
} from "@/lib/document-templates";

interface DocumentTemplatesProps {
  facility: OrgData;
  templateSettings: DocumentTemplateSettings;
  setTemplateSettings: (data: DocumentTemplateSettings) => void;
  ttpl: (key: string, values?: Record<string, string | number>) => string;
}

// Templates without demo data: their preview needs a real document (a claim, an admission),
// so they are previewed from where they are printed.
const NO_DEMO_PREVIEW: ReadonlySet<DocumentTemplateId> = new Set(["insurance_claims", "medical_record"]);

const TEMPLATE_IDS: DocumentTemplateId[] = [
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
];

const fieldClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400";

function CharCount({ value, max }: { value: string; max: number }) {
  return <span className={`text-[10px] ${value.length > max ? "text-red-600" : "text-slate-400"}`}>{value.length}/{max}</span>;
}

// Settings > Document templates: global branding of every printed document, and the texts of
// each template (title, introduction, closing note). Changes are kept in the page state and
// saved with the page's "Save changes" button (PUT /api/v1/settings/templates, admin only).
export function DocumentTemplates({ facility, templateSettings, setTemplateSettings, ttpl }: DocumentTemplatesProps) {
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplateId | null>(null);
  const [editing, setEditing] = useState<DocumentTemplateId | null>(null);
  const [draft, setDraft] = useState<TemplateTexts>({ title: "", intro: "", closing: "" });

  const templateName = (id: DocumentTemplateId) => ttpl(`${id}_title`);

  const openEditor = (id: DocumentTemplateId) => {
    setDraft(templateTexts(templateSettings, id));
    setEditing(id);
  };

  const draftValid =
    draft.title.length <= TEMPLATE_TEXT_LIMITS.title &&
    draft.intro.length <= TEMPLATE_TEXT_LIMITS.intro &&
    draft.closing.length <= TEMPLATE_TEXT_LIMITS.closing;

  const applyDraft = () => {
    if (!editing || !draftValid) return;
    const templates = { ...templateSettings.templates };
    const texts = { title: draft.title.trim(), intro: draft.intro.trim(), closing: draft.closing.trim() };
    if (texts.title || texts.intro || texts.closing) templates[editing] = texts;
    else delete templates[editing];
    setTemplateSettings({ ...templateSettings, templates });
    setEditing(null);
  };

  const isCustomized = (id: DocumentTemplateId) => Boolean(templateSettings.templates[id]);

  return (
    <div className="bg-white rounded-2xl md:rounded border border-slate-200 shadow-sm p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" /> {ttpl('title')}
        </h2>
        <p className="text-xs text-slate-500 mt-1">{ttpl('description')}</p>
      </div>
      <div className="h-px bg-slate-100 w-full" />

      <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-4">
        {TEMPLATE_IDS.map((id) => (
          <div key={id} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/20 transition-all group flex flex-col">
            <div className="flex justify-between items-start mb-2 gap-2">
              <h3 className="text-sm font-bold text-slate-800">{templateName(id)}</h3>
              <div className="flex items-center gap-1.5 shrink-0">
                {isCustomized(id) && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">{ttpl('customized')}</span>
                )}
                <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600">
                  <Printer className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed flex-1">{ttpl(`${id}_desc`)}</p>
            <div className="flex gap-2 mt-auto pt-4">
              <Button
                onClick={() => openEditor(id)}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2 font-semibold border-slate-200 hover:border-blue-300 hover:text-blue-600 flex items-center gap-1.5"
              >
                <Pencil className="w-3 h-3" /> {ttpl('edit_template')}
              </Button>
              {!NO_DEMO_PREVIEW.has(id) && (
                <Button
                  onClick={() => setPreviewTemplate(id)}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5"
                >
                  <Eye className="w-3 h-3" /> {ttpl('preview')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mt-6">
        <div className="flex gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800">{ttpl('global_branding')}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{ttpl('global_branding_desc')}</p>
            </div>
            <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-4">
              {(
                [
                  { id: 'showLogo', label: ttpl('show_logo') },
                  { id: 'digitalSignature', label: ttpl('digital_signature') },
                  { id: 'watermark', label: ttpl('confidentiality_watermark') },
                ] satisfies { id: 'showLogo' | 'digitalSignature' | 'watermark'; label: string }[]
              ).map((setting) => (
                <div key={setting.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={setting.id}
                    checked={templateSettings[setting.id]}
                    onChange={(e) => setTemplateSettings({ ...templateSettings, [setting.id]: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <label htmlFor={setting.id} className="text-[11px] text-slate-600 cursor-pointer">{setting.label}</label>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="footerText" className="text-[11px] font-semibold text-slate-700">{ttpl('footer_text')}</label>
                <CharCount value={templateSettings.footerText} max={TEMPLATE_TEXT_LIMITS.footerText} />
              </div>
              <input
                id="footerText"
                value={templateSettings.footerText}
                maxLength={TEMPLATE_TEXT_LIMITS.footerText}
                onChange={(e) => setTemplateSettings({ ...templateSettings, footerText: e.target.value })}
                placeholder={ttpl('footer_text_placeholder')}
                className={fieldClass}
              />
              <p className="text-[10px] text-slate-500">{ttpl('footer_text_hint')}</p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{ttpl('edit_dialog_title', { name: templateName(editing) })}</DialogTitle>
                <DialogDescription className="text-xs">{ttpl('edit_dialog_desc')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {(
                  [
                    { field: 'title', label: ttpl('field_title'), hint: ttpl('field_title_hint'), multiline: false },
                    { field: 'intro', label: ttpl('field_intro'), hint: ttpl('field_intro_hint'), multiline: true },
                    { field: 'closing', label: ttpl('field_closing'), hint: ttpl('field_closing_hint'), multiline: true },
                  ] satisfies { field: keyof TemplateTexts; label: string; hint: string; multiline: boolean }[]
                ).map(({ field, label, hint, multiline }) => (
                  <div key={field} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor={`tpl-${field}`} className="text-[11px] font-semibold text-slate-700">{label}</label>
                      <CharCount value={draft[field]} max={TEMPLATE_TEXT_LIMITS[field]} />
                    </div>
                    {multiline ? (
                      <textarea
                        id={`tpl-${field}`}
                        rows={3}
                        value={draft[field]}
                        maxLength={TEMPLATE_TEXT_LIMITS[field]}
                        onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                        className={fieldClass}
                      />
                    ) : (
                      <input
                        id={`tpl-${field}`}
                        value={draft[field]}
                        maxLength={TEMPLATE_TEXT_LIMITS[field]}
                        onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                        className={fieldClass}
                      />
                    )}
                    <p className="text-[10px] text-slate-500">{hint}</p>
                  </div>
                ))}
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">{ttpl('save_reminder')}</p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDraft({ title: "", intro: "", closing: "" })}>
                  {ttpl('reset_defaults')}
                </Button>
                <Button size="sm" className="text-xs" disabled={!draftValid} onClick={applyDraft}>
                  {ttpl('apply')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PDFPreviewModal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        templateId={previewTemplate || ''}
        facility={{
          name: facility.name,
          address: facility.address,
          phone: facility.contactPhone,
          email: facility.contactEmail,
          logoUrl: facility.logoUrl || undefined,
          taxId: facility.taxId || undefined,
        }}
        settings={templateSettings}
      />
    </div>
  );
}
