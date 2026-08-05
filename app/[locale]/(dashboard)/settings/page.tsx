"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building, User, ShieldCheck, Database, LayoutTemplate, Link2, Users, FileText, Loader2, Key
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

// Modular Components
import { UsersManagement } from "@/components/settings/users-management";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { OrganizationSettings } from "@/components/settings/organization-settings";
import { ModuleConfiguration } from "@/components/settings/module-configuration";
import { DocumentTemplates } from "@/components/settings/document-templates";
import { Dhis2IntegrationSettings } from "@/components/settings/dhis2-integration-settings";

export default function SettingsPage() {
  const { currentUser, activeModules, setActiveModules, setUser } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    language: "en",
    password: "",
    confirmPassword: ""
  });

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

  // Database Backup State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);

  // License Management State
  const [licenseKey, setLicenseKey] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);

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
  const tmat = useTranslations('maternity');
  const ttpl = useTranslations('templates');

  const isSysAdmin = currentUser?.role === "tenant_admin";

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [orgRes, tplRes, backupRes, licenseRes] = await Promise.all([
          fetch('/api/v1/settings/organization'),
          fetch('/api/v1/settings/templates'),
          isSysAdmin ? fetch('/api/v1/settings/database') : Promise.resolve(null),
          isSysAdmin ? fetch('/api/v1/licensing/status') : Promise.resolve(null)
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

        if (backupRes && backupRes.ok) {
          const data = await backupRes.json();
          setBackupHistory(data.backups || []);
        }

        if (licenseRes && licenseRes.ok) {
          const data = await licenseRes.json();
          setCurrentSubscription(data);
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
  }, [currentUser, isSysAdmin]);

  useEffect(() => {
    if (currentUser) {
      setProfileData(prev => ({
        ...prev,
        fullName: currentUser.fullName || "",
        email: currentUser.email || ""
      }));
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
    { id: "MODULE_PLANNING", name: tplan('title'), desc: tplan('description') },
    { id: "MODULE_MATERNITY", name: tmat('title'), desc: tmat('description') }
  ];

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
    setProfileError(null);
    try {
      if (activeTab === "profile") {
        if (!currentUser?.id) {
          setProfileError(tc('save_error'));
          return;
        }

        if (profileData.password || profileData.confirmPassword) {
          if (profileData.password !== profileData.confirmPassword) {
            setProfileError(tc('password_mismatch'));
            return;
          }
          if (profileData.password.length > 0 && profileData.password.length < 8) {
            setProfileError(tc('password_min_length'));
            return;
          }
        }

        const response = await fetch(`/api/v1/users/${currentUser?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: profileData.fullName,
            email: profileData.email,
            password: profileData.password || undefined
          })
        });

        if (!response.ok) {
          const error = await response.json();
          setProfileError(error?.error || tc('save_error'));
          return;
        }

        const updatedUser = await response.json();
        setUser({
          id: updatedUser.id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          role: updatedUser.role
        });
        setProfileData({
          ...profileData,
          password: "",
          confirmPassword: ""
        });
      } else if (activeTab === "organization") {
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
      if (activeTab === "profile") {
        setProfileError(tc('save_error'));
      }
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      const response = await fetch('/api/v1/settings/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });

      if (response.ok) {
        // Create a blob from the response and trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(`Erreur lors du téléchargement: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to download backup:", error);
      alert("Erreur lors du téléchargement de la sauvegarde");
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const response = await fetch('/api/v1/settings/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh backup history
        const backupRes = await fetch('/api/v1/settings/database');
        if (backupRes.ok) {
          const backupData = await backupRes.json();
          setBackupHistory(backupData.backups || []);
        }
        alert(`Sauvegarde créée avec succès: ${data.backupFile} (${data.size})`);
      } else {
        const error = await response.json();
        alert(`Erreur lors de la sauvegarde: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to create backup:", error);
      alert("Erreur lors de la création de la sauvegarde");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRedeemLicense = async () => {
    if (!licenseKey.trim()) {
      setLicenseError(t("please_enter_license_key"));
      return;
    }

    setIsRedeeming(true);
    setLicenseError(null);
    setLicenseSuccess(null);

    try {
      const response = await fetch("/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || t("license_redeem_error"));
      }

      setLicenseKey("");
      setLicenseSuccess(t("license_redeemed", { date: new Date(payload.activeUntil).toLocaleDateString() }));
      
      // Refresh subscription status
      const licenseRes = await fetch('/api/v1/licensing/status');
      if (licenseRes.ok) {
        const data = await licenseRes.json();
        setCurrentSubscription(data);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("license_redeem_error");
      setLicenseError(message);
    } finally {
      setIsRedeeming(false);
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
                <TabsTrigger value="database" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
                  <Database className="h-4 w-4 mr-3" /> {t('database_backup')}
                </TabsTrigger>
                <TabsTrigger value="license" className="justify-start px-4 py-2.5 text-sm rounded-md text-slate-600 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none hover:bg-slate-100">
                  <Key className="h-4 w-4 mr-3" /> {t('license_management')}
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
              <ProfileSettings
                currentUser={currentUser}
                profileData={profileData}
                setProfileData={setProfileData}
                t={t}
                tc={tc}
                error={profileError}
              />
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
                    t={t}
                    readOnly
                    showOnlyActive
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

                <TabsContent value="database" className="m-0 mt-0 focus-visible:outline-none">
                  <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{t('database_backup')}</h2>
                      <p className="text-xs text-slate-500">{t('database_backup_desc')}</p>
                    </div>

                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg bg-amber-50/30">
                      <Database className="h-10 w-10 text-amber-300 mx-auto mb-3" />
                      <h3 className="text-sm font-bold text-amber-800">{t('backup_database')}</h3>
                      <p className="text-xs text-amber-600/70 mt-1 max-w-sm mx-auto">{t('backup_database_desc')}</p>
                      <Button
                        onClick={handleCreateBackup}
                        disabled={isBackingUp}
                        variant="outline"
                        size="sm"
                        className="mt-4 border-amber-200 text-amber-700 hover:bg-amber-50 text-xs"
                      >
                        {isBackingUp ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            {tc('saving')}
                          </>
                        ) : (
                          t('create_backup')
                        )}
                      </Button>
                    </div>

                    {backupHistory.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700">Historique des sauvegardes</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {backupHistory.map((backup, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">{backup.filename}</p>
                                <p className="text-xs text-slate-500">
                                  {new Date(backup.createdAt).toLocaleString()} • {backup.size}
                                </p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs text-slate-600 hover:text-slate-800"
                                onClick={() => handleDownloadBackup(backup.filename)}
                              >
                                {t('download_backup')}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="license" className="m-0 mt-0 focus-visible:outline-none">
                  <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{t('license_management')}</h2>
                      <p className="text-xs text-slate-500">{t('license_management_desc')}</p>
                    </div>

                    {currentSubscription && (
                      <div className="bg-slate-50 rounded-lg p-4 border">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('current_subscription')}</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">{t('subscription_status')}:</span>
                            <span className="ml-2 font-medium text-slate-900">
                              {currentSubscription.isActive ? tc('active') : tc('inactive')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">{t('valid_until')}:</span>
                            <span className="ml-2 font-medium text-slate-900">
                              {currentSubscription.validUntil ? new Date(currentSubscription.validUntil).toLocaleDateString() : tc('unknown')}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">{currentSubscription.reason}</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700">{t('extend_access')}</h3>
                        <p className="text-xs text-slate-500 mt-1">{t('extend_access_desc')}</p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label htmlFor="license-key" className="text-sm font-medium text-slate-700">
                            {t('enter_license_key')}
                          </label>
                          <Input
                            id="license-key"
                            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                            value={licenseKey}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setLicenseKey(event.target.value.toUpperCase())}
                            disabled={isRedeeming}
                            className="font-mono"
                          />
                        </div>

                        {licenseError && (
                          <p className="text-sm text-red-600">{licenseError}</p>
                        )}

                        {licenseSuccess && (
                          <p className="text-sm text-green-600">{licenseSuccess}</p>
                        )}

                        <Button 
                          onClick={handleRedeemLicense} 
                          disabled={isRedeeming || !licenseKey.trim()}
                          className="w-full"
                        >
                          {isRedeeming ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              {t('redeeming')}
                            </>
                          ) : (
                            t('redeem_license')
                          )}
                        </Button>
                      </div>
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
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-slate-900">{t('integrations')}</h2>
                    <p className="text-xs text-slate-500">Manage HL7 pipelines, DICOM servers, and generic APIs.</p>
                  </div>
                  <Dhis2IntegrationSettings />
                </TabsContent>
              </>)}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
