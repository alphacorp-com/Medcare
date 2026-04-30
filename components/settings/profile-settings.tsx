import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProfileSettingsProps {
  currentUser: any;
  t: (key: string) => string;
  tc: (key: string) => string;
}

export function ProfileSettings({ currentUser, t, tc }: ProfileSettingsProps) {
  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{t('personal_info')}</h2>
        <p className="text-xs text-slate-500">{t('personal_info_desc')}</p>
      </div>
      <div className="h-px bg-slate-100 w-full" />
      <div className="flex items-center gap-6">
        <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center text-xl font-bold text-slate-400 border-2 border-slate-200">
          {currentUser?.fullName?.charAt(0) || "U"}
        </div>
        <Button variant="outline" size="sm" className="text-xs">{t('change_avatar')}</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{tc('name')}</label>
          <Input defaultValue={currentUser?.fullName} className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{tc('email')}</label>
          <Input defaultValue={currentUser?.email} className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{tc('role')}</label>
          <Input defaultValue={currentUser?.role} disabled className="text-sm h-10 bg-slate-50 text-slate-500 font-mono" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{tc('language')}</label>
          <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500">
            <option>English (UK)</option>
            <option>French (FR)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
