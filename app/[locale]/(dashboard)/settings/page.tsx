"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  Building, User, Settings2, ShieldCheck, Database, LayoutTemplate, Link2, UploadCloud, ImageIcon, Users
} from "lucide-react";
import { useState } from "react";
import { UsersManagement } from "@/components/settings/users-management";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const { currentUser, activeModules, setActiveModules } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tp = useTranslations('patients');
  const tadm = useTranslations('admissions');
  const tph = useTranslations('pharmacy');
  const tlab = useTranslations('lab');
  const trad = useTranslations('radiology');
  const tsurg = useTranslations('surgery');
  const tbill = useTranslations('billing');
  const tplan = useTranslations('planning');

  const APP_MODULES = [
    { id: "MODULE_CORE_PATIENT", name: tp('module_title'), desc: tp('module_desc'), required: true },
    { id: "MODULE_ADMISSION", name: tadm('title'), desc: tadm('description') },
    { id: "MODULE_PHARMACY", name: tph('title'), desc: tph('description') },
    { id: "MODULE_LAB", name: tlab('title'), desc: tlab('description') },
    { id: "MODULE_SURGERY", name: tsurg('title'), desc: tsurg('description') },
    { id: "MODULE_RADIOLOGY", name: trad('title'), desc: trad('description') },
    { id: "MODULE_BILLING", name: tbill('title'), desc: tbill('description') },
    { id: "MODULE_PLANNING", name: tplan('title'), desc: tplan('description') }
  ];

  const isSysAdmin = currentUser?.role === "System Administrator";

  const handleModuleToggle = (moduleId: string, isRequired?: boolean) => {
    if (isRequired) return; // Core patient management cannot be disabled inside this environment
    
    if (activeModules.includes(moduleId)) {
      setActiveModules(activeModules.filter(m => m !== moduleId));
    } else {
      setActiveModules([...activeModules, moduleId]);
    }
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  return (
    <div className="flex flex-col h-full space-y-4 max-w-5xl mx-auto w-full pb-8">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm mt-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
        </div>
        <Button onClick={handleSaveSettings} disabled={isSaving} className="bg-slate-900 text-white hover:bg-slate-800 text-xs h-8">
          {isSaving ? tc('saving') : tc('save_changes')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 items-start">
        <Tabs defaultValue="profile" orientation="vertical" className="flex-1 w-full flex flex-col md:flex-row gap-8">
           <TabsList className="flex flex-col justify-start h-auto bg-transparent items-stretch space-y-1 md:w-64 shrink-0 p-0">
             <TabsTrigger value="profile" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
               <User className="h-4 w-4 mr-3" /> {t('user_profile')}
             </TabsTrigger>
             
             {isSysAdmin && (
               <>
                 <TabsTrigger value="users" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
                   <Users className="h-4 w-4 mr-3" /> {t('users_roles')}
                 </TabsTrigger>
                 <TabsTrigger value="organization" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
                   <Building className="h-4 w-4 mr-3" /> {t('organization')}
                 </TabsTrigger>
                 <TabsTrigger value="modules" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
                   <LayoutTemplate className="h-4 w-4 mr-3" /> {t('clinical_modules')}
                 </TabsTrigger>
                 <div className="h-px bg-slate-200 my-4 mx-2"></div>
                 <TabsTrigger value="security" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
                   <ShieldCheck className="h-4 w-4 mr-3" /> {t('security')}
                 </TabsTrigger>
                 <TabsTrigger value="integrations" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
                   <Link2 className="h-4 w-4 mr-3" /> {t('integrations')}
                 </TabsTrigger>
               </>
             )}
           </TabsList>

           <div className="flex-1 max-w-3xl min-w-0">
              <TabsContent value="profile" className="m-0 mt-0 focus-visible:outline-none">
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
              </TabsContent>

              {isSysAdmin && (
                <>
                  <TabsContent value="users" className="m-0 mt-0 focus-visible:outline-none">
                     <UsersManagement />
                  </TabsContent>

                  <TabsContent value="organization" className="m-0 mt-0 focus-visible:outline-none">
                     <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{t('facility_config')}</h2>
                      <p className="text-xs text-slate-500">{t('facility_config_desc')}</p>
                    </div>
                    <div className="h-px bg-slate-100 w-full" />
                    <div className="space-y-6">
                       
                       {/* Logo Upload Section */}
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Facility Logo</label>
                         <div className="flex gap-6 items-center">
                            <div className="h-20 w-20 flex-shrink-0 bg-slate-50 border border-slate-200 rounded flex items-center justify-center p-2 shadow-sm">
                               <ImageIcon className="h-8 w-8 text-slate-300" />
                            </div>
                            <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 hover:border-blue-300 transition-colors cursor-pointer group">
                               <div className="flex flex-col items-center gap-1">
                                  <UploadCloud className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                  <p className="text-xs text-slate-600 font-medium">Click to upload or drag and drop</p>
                                  <p className="text-[10px] text-slate-400">SVG, PNG, JPG or GIF (max. 2MB)</p>
                                </div>
                            </div>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t('facility_name')}</label>
                            <Input defaultValue="Main Hospital Network" className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tax ID / FINESS</label>
                            <Input defaultValue="1000000100" className="text-sm h-10 font-mono transition-all focus-visible:ring-blue-500 bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{tc('phone')}</label>
                            <Input defaultValue="+33 1 00 00 00 00" type="tel" className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t('physical_address')}</label>
                            <Input defaultValue="1 Avenue de l'Hôpital, 75000 Paris" className="text-sm h-10 transition-all focus-visible:ring-blue-500 bg-white" />
                          </div>
                       </div>
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="modules" className="m-0 mt-0 focus-visible:outline-none">
                 <div className="bg-white rounded border border-slate-200 shadow-sm p-0 overflow-hidden">
                    <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <LayoutTemplate className="h-5 w-5 text-blue-600" /> {t('module_config')}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">{t('module_config_desc')}</p>
                    </div>
                    
                    <div className="divide-y divide-slate-100">
                       {APP_MODULES.map((mod) => {
                          const isActive = activeModules.includes(mod.id);
                          return (
                            <div key={mod.id} className={cn("p-5 flex items-start gap-4 transition-colors", isActive ? "bg-white" : "bg-slate-50/50")}>
                               <div className="pt-0.5">
                                 <button 
                                   onClick={() => handleModuleToggle(mod.id, mod.required)}
                                   disabled={mod.required}
                                   className={cn(
                                     "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
                                     isActive ? "bg-blue-600" : "bg-slate-300",
                                     mod.required && "opacity-50"
                                   )}
                                 >
                                   <span className={cn(
                                     "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                     isActive ? "translate-x-4" : "translate-x-0"
                                   )} />
                                 </button>
                               </div>
                               <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                     <h3 className={cn("text-sm font-bold", isActive ? "text-slate-900" : "text-slate-500")}>
                                       {mod.name} 
                                       {mod.required && <span className="ml-2 text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold border border-slate-200">{t('module_required')}</span>}
                                       {isActive && !mod.required && <span className="ml-2 text-[9px] uppercase tracking-wider bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold border border-blue-200">{t('module_active')}</span>}
                                     </h3>
                                     <span className="text-[10px] font-mono text-slate-400">{mod.id}</span>
                                  </div>
                                  <p className={cn("text-xs mt-1 leading-relaxed max-w-lg", isActive ? "text-slate-600" : "text-slate-400")}>
                                     {mod.desc}
                                  </p>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="security" className="m-0 mt-0 focus-visible:outline-none">
                 <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{t('security')}</h2>
                      <p className="text-xs text-slate-500">Configure global authentication mechanisms.</p>
                    </div>
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg">
                       <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                       <h3 className="text-sm font-bold text-slate-700">SSO & RBAC Settings</h3>
                       <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Role Based Access Control is managed dynamically via Users Configuration.</p>
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="integrations" className="m-0 mt-0 focus-visible:outline-none">
                 <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{t('integrations')}</h2>
                      <p className="text-xs text-slate-500">Manage HL7 pipelines, DICOM servers, and generic APIs.</p>
                    </div>
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg bg-blue-50/30">
                       <Database className="h-10 w-10 text-blue-300 mx-auto mb-3" />
                       <h3 className="text-sm font-bold text-blue-800">No active integrations</h3>
                       <p className="text-xs text-blue-600/70 mt-1 max-w-sm mx-auto">Connect to external laboratory partners, PACs, or government health networks securely via modern REST or legacy HL7v2 connections.</p>
                       <Button variant="outline" size="sm" className="mt-4 border-blue-200 text-blue-700 hover:bg-blue-50 text-xs">Configure Pipeline</Button>
                    </div>
                 </div>
              </TabsContent>
              </>)}
           </div>
        </Tabs>
      </div>
    </div>
  );
}
