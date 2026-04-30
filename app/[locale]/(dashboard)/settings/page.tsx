"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building, User, ShieldCheck, Database, LayoutTemplate, Link2, Users, FileText, Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

// Modular Components
import { UsersManagement } from "@/components/settings/users-management";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { OrganizationSettings } from "@/components/settings/organization-settings";
import { ModuleConfiguration } from "@/components/settings/module-configuration";
import { DocumentTemplates } from "@/components/settings/document-templates";

export default function SettingsPage() {
  const { currentUser, activeModules, setActiveModules } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  // Organization State
  const [orgData, setOrgData] = useState({
    name: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    logoUrl: "",
    taxId: "",
    website: ""
  });

  // Templates State
  const [templateSettings, setTemplateSettings] = useState({
    showLogo: true,
    includeQR: true,
    digitalSignature: true,
    watermark: false
  });

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
  const ttpl = useTranslations('templates');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [orgRes, tplRes] = await Promise.all([
          fetch('/api/v1/settings/organization'),
          fetch('/api/v1/settings/templates')
        ]);

        if (orgRes.ok) {
          const data = await orgRes.json();
          setOrgData({
            name: data.name || "",
            contactEmail: data.contactEmail || "",
            contactPhone: data.contactPhone || "",
            address: data.address || "",
            logoUrl: data.logoUrl || "",
            taxId: data.metadata?.taxId || "",
            website: data.metadata?.website || ""
          });
        }

        if (tplRes.ok) {
          const data = await tplRes.json();
          setTemplateSettings(prev => ({ ...prev, ...data }));
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

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

  const isSysAdmin = currentUser?.role === "tenant_admin";

  const handleModuleToggle = (moduleId: string, isRequired?: boolean) => {
    if (isRequired) return;

    if (activeModules.some(m => m.moduleId === moduleId)) {
      setActiveModules(activeModules.filter(m => m.moduleId !== moduleId));
    } else {
      setActiveModules([...activeModules, { moduleId, actions: ["read", "create", "update", "delete"] }]);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      if (activeTab === "organization") {
        await fetch('/api/v1/settings/organization', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orgData)
        });
      } else if (activeTab === "templates") {
        await fetch('/api/v1/settings/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateSettings)
        });
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 max-w-5xl mx-auto w-full pb-8">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm mt-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 self-center mr-2" />}
          <Button onClick={handleSaveSettings} disabled={isSaving || isLoading} className="bg-slate-900 text-white hover:bg-slate-800 text-xs h-8">
            {isSaving ? tc('saving') : tc('save_changes')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 items-start">
        <Tabs defaultValue="profile" onValueChange={setActiveTab} orientation="vertical" className="flex-1 w-full flex flex-col md:flex-row gap-8">
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
                <TabsTrigger value="templates" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
                  <FileText className="h-4 w-4 mr-3" /> {ttpl('title')}
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
              <ProfileSettings currentUser={currentUser} t={t} tc={tc} />
            </TabsContent>

            {isSysAdmin && (
              <>
                <TabsContent value="users" className="m-0 mt-0 focus-visible:outline-none">
                  <UsersManagement />
                </TabsContent>

                <TabsContent value="organization" className="m-0 mt-0 focus-visible:outline-none">
                  <OrganizationSettings orgData={orgData} setOrgData={setOrgData} t={t} tc={tc} />
                </TabsContent>

                <TabsContent value="modules" className="m-0 mt-0 focus-visible:outline-none">
                  <ModuleConfiguration 
                    appModules={APP_MODULES} 
                    activeModules={activeModules} 
                    handleModuleToggle={handleModuleToggle} 
                    t={t} 
                  />
                </TabsContent>

                <TabsContent value="templates" className="m-0 mt-0 focus-visible:outline-none">
                  <DocumentTemplates 
                    facility={orgData}
                    templateSettings={templateSettings} 
                    setTemplateSettings={setTemplateSettings} 
                    ttpl={ttpl} 
                  />
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
