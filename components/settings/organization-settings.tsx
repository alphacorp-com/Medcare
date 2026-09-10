import { Input } from "@/components/ui/input";
import { ImageIcon, UploadCloud } from "lucide-react";

interface OrganizationSettingsProps {
  orgData: {
    name: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    logoUrl: string;
    taxId: string;
    website: string;
  };
  setOrgData: (data: any) => void;
  t: (key: string) => string;
  tc: (key: string) => string;
}

export function OrganizationSettings({ orgData, setOrgData, t, tc }: OrganizationSettingsProps) {
  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOrgData({ ...orgData, logoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{t('facility_config')}</h2>
        <p className="text-xs text-slate-500">{t('facility_config_desc')}</p>
      </div>
      <div className="h-px bg-slate-100 w-full" />
      <div className="space-y-6">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Facility Logo</label>
          <div className="flex gap-6 items-center">
            <div className="h-20 w-20 flex-shrink-0 bg-slate-50 border border-slate-200 rounded flex items-center justify-center p-2 shadow-sm overflow-hidden">
              {orgData.logoUrl ? (
                <img src={orgData.logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <label className="flex-1 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 hover:border-blue-300 transition-colors cursor-pointer group">
              <div className="flex flex-col items-center gap-1">
                <UploadCloud className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                <p className="text-xs text-slate-600 font-medium">Click to upload or drag and drop</p>
                <p className="text-[10px] text-slate-400">SVG, PNG, JPG or GIF (max. 2MB)</p>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t('facility_name')}</label>
            <Input 
              value={orgData.name} 
              onChange={(e) => setOrgData({...orgData, name: e.target.value})}
              className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t('tax_id')}</label>
            <Input 
              value={orgData.taxId} 
              onChange={(e) => setOrgData({...orgData, taxId: e.target.value})}
              className="text-sm h-10 font-mono transition-all focus-visible:ring-blue-500 bg-white" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{tc('phone')}</label>
            <Input 
              value={orgData.contactPhone} 
              onChange={(e) => setOrgData({...orgData, contactPhone: e.target.value})}
              type="tel" 
              className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{tc('email')}</label>
            <Input 
              value={orgData.contactEmail} 
              onChange={(e) => setOrgData({...orgData, contactEmail: e.target.value})}
              type="email" 
              className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" 
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t('website')}</label>
            <Input 
              value={orgData.website} 
              onChange={(e) => setOrgData({...orgData, website: e.target.value})}
              type="url" 
              className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" 
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t('physical_address')}</label>
            <Input 
              value={orgData.address} 
              onChange={(e) => setOrgData({...orgData, address: e.target.value})}
              className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
