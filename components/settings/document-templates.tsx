import { Button } from "@/components/ui/button";
import { FileText, Printer, ShieldCheck } from "lucide-react";

interface DocumentTemplatesProps {
  templateSettings: {
    showLogo: boolean;
    includeQR: boolean;
    digitalSignature: boolean;
    watermark: boolean;
  };
  setTemplateSettings: (data: any) => void;
  ttpl: (key: string) => string;
}

export function DocumentTemplates({ templateSettings, setTemplateSettings, ttpl }: DocumentTemplatesProps) {
  const templates = [
    { id: 'invoices', name: ttpl('invoices_title'), desc: ttpl('invoices_desc') },
    { id: 'patient_lists', name: ttpl('patient_lists_title'), desc: ttpl('patient_lists_desc') },
    { id: 'medications', name: ttpl('medications_title'), desc: ttpl('medications_desc') },
    { id: 'stock_reports', name: ttpl('stock_reports_title'), desc: ttpl('stock_reports_desc') },
    { id: 'patient_files', name: ttpl('patient_files_title'), desc: ttpl('patient_files_desc') },
    { id: 'lab_results', name: ttpl('lab_results_title'), desc: ttpl('lab_results_desc') },
    { id: 'prescriptions', name: ttpl('prescriptions_title'), desc: ttpl('prescriptions_desc') }
  ];

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" /> {ttpl('title')}
        </h2>
        <p className="text-xs text-slate-500 mt-1">{ttpl('description')}</p>
      </div>
      <div className="h-px bg-slate-100 w-full" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <div key={tpl.id} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-bold text-slate-800">{tpl.name}</h3>
              <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600">
                <Printer className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              {tpl.desc}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 font-semibold border-slate-200 hover:border-blue-300 hover:text-blue-600">
                {ttpl('edit_template')}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                {ttpl('preview')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mt-6">
        <div className="flex gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">{ttpl('global_branding')}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{ttpl('global_branding_desc')}</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {[
                { id: 'showLogo', label: ttpl('show_logo') },
                { id: 'includeQR', label: ttpl('include_qr') },
                { id: 'digitalSignature', label: ttpl('digital_signature') },
                { id: 'watermark', label: ttpl('confidentiality_watermark') },
              ].map((setting) => (
                <div key={setting.id} className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={(templateSettings as any)[setting.id]} 
                    onChange={(e) => setTemplateSettings({...templateSettings, [setting.id]: e.target.checked})}
                    className="rounded border-slate-300 text-blue-600" 
                  />
                  <span className="text-[11px] text-slate-600">{setting.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
