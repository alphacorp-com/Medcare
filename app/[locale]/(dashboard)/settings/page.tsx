"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building, User, DatabaseBackup, LayoutTemplate, Link2, Users, UserCog, FileText, Loader2, ServerCog, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect, Suspense, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import StandardMobileTemplate from "@/components/layout/mobile/StandardMobileTemplate";
import { scrollMobileContentToTop } from "@/components/layout/mobile/MobileLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { SettingsMobileBackButton, SettingsMobileMenu } from "@/components/settings/settings-ui";
import { useSettingsNavGroups } from "@/components/settings/settings-nav";

// Modular Components
import { UsersManagement } from "@/components/settings/users-management";
import { RolesManagement } from "@/components/settings/roles-management";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { ChangePasswordCard } from "@/components/settings/change-password-card";
import { OrganizationSettings } from "@/components/settings/organization-settings";
import { ModuleConfiguration } from "@/components/settings/module-configuration";
import { DocumentTemplates } from "@/components/settings/document-templates";
import { DatabaseBackupSettings } from "@/components/settings/database-backup";
import { DEFAULT_DOCUMENT_TEMPLATE_SETTINGS, normalizeDocumentTemplateSettings, type DocumentTemplateSettings } from "@/lib/document-templates";
import { toast } from "sonner";
import { Dhis2IntegrationSettings } from "@/components/settings/dhis2-integration-settings";
import { MobileMoneySettings } from "@/components/settings/mobile-money-settings";
import { OnPremLicensePanel } from "@/components/settings/onprem-license-panel";

// One entry per "General" settings section — drives both the desktop tabs and the mobile menu.
type SettingsSection = {
  key: string;
  label: string;
  icon: LucideIcon;
  content: React.ReactNode;
  adminOnly?: boolean;
  // Persisted by the page-level save button (handleSaveSettings); other sections save themselves.
  savable?: boolean;
  separatorBefore?: boolean;
};

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const { currentUser, activeModules, setActiveModules, setUser } = useAppStore();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "profile";
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Deployment switches (MOBILE_MONEY_SETTINGS_ENABLED…), read at run time from the server.
  const [features, setFeatures] = useState<{ mobileMoneySettings: boolean }>({ mobileMoneySettings: false });
  const [activeTab, setActiveTab] = useState(initialTab);
  // Mobile shows the section list first; a `?tab=` deep link opens that section directly.
  const [mobileSelected, setMobileSelected] = useState<string | null>(searchParams.get("tab"));
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    language: "en"
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
  const [templateSettings, setTemplateSettings] = useState<DocumentTemplateSettings>(DEFAULT_DOCUMENT_TEMPLATE_SETTINGS);

  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tp = useTranslations('patients');
  const isMobile = useIsMobile();
  const tadm = useTranslations('admissions');
  const tappt = useTranslations('appointments');
  const tph = useTranslations('pharmacy');
  const tlab = useTranslations('lab');
  const trad = useTranslations('radiology');
  const tsurg = useTranslations('surgery');
  const tbill = useTranslations('billing');
  const tplan = useTranslations('planning');
  const tmat = useTranslations('maternity');
  const tdp = useTranslations('diseasePrograms');
  const ttpl = useTranslations('templates');
  const tnav = useTranslations('settings.nav');
  const navGroups = useSettingsNavGroups();

  const isSysAdmin = currentUser?.isSystemAdmin === true;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [orgRes, tplRes, featuresRes] = await Promise.all([
          fetch('/api/v1/settings/organization'),
          fetch('/api/v1/settings/templates'),
          fetch('/api/v1/settings/features'),
        ]);
        if (featuresRes.ok) setFeatures(await featuresRes.json());

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
          setTemplateSettings(normalizeDocumentTemplateSettings(data));
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
    if (!currentUser) return;

    const timeoutId = window.setTimeout(() => {
      setProfileData((prev) => ({
        ...prev,
        fullName: currentUser.fullName || "",
        email: currentUser.email || ""
      }));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [currentUser]);

  const APP_MODULES = [
    { id: "MODULE_CORE_PATIENT", name: tp('module_title'), desc: tp('module_desc'), required: true },
    { id: "MODULE_ADMISSION", name: tadm('title'), desc: tadm('description') },
    { id: "MODULE_APPOINTMENTS", name: tappt('module_title'), desc: tappt('module_desc') },
    { id: "MODULE_PHARMACY", name: tph('title'), desc: tph('description') },
    { id: "MODULE_LAB", name: tlab('title'), desc: tlab('description') },
    { id: "MODULE_SURGERY", name: tsurg('title'), desc: tsurg('description') },
    { id: "MODULE_RADIOLOGY", name: trad('title'), desc: trad('description') },
    { id: "MODULE_BILLING", name: tbill('title'), desc: tbill('description') },
    { id: "MODULE_PLANNING", name: tplan('title'), desc: tplan('description') },
    { id: "MODULE_MATERNITY", name: tmat('title'), desc: tmat('description') },
    { id: "MODULE_DISEASE_PROGRAMS", name: tdp('module_title'), desc: tdp('module_desc') }
  ];

  const handleModuleToggle = (moduleId: string, isRequired?: boolean) => {
    if (isRequired) return;

    if (activeModules.some(m => m.moduleId === moduleId)) {
      setActiveModules(activeModules.filter(m => m.moduleId !== moduleId));
    } else {
      setActiveModules([...activeModules, { moduleId, actions: ["read", "create", "update", "delete", "validate"] }]);
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

        const response = await fetch(`/api/v1/users/${currentUser?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: profileData.fullName,
            email: profileData.email
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
          role: updatedUser.role,
          isSystemAdmin: updatedUser.isSystemAdmin
        });
      } else if (activeTab === "organization") {
        await fetch('/api/v1/settings/organization', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orgData)
        });
      } else if (activeTab === "templates") {
        const response = await fetch('/api/v1/settings/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateSettings)
        });
        if (!response.ok) {
          toast.error(ttpl('save_failed'));
          return;
        }
        setTemplateSettings(normalizeDocumentTemplateSettings(await response.json()));
        toast.success(ttpl('saved'));
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

  const sections: SettingsSection[] = [
    {
      key: "profile",
      label: t("user_profile"),
      icon: User,
      savable: true,
      content: (
        <div className="space-y-6">
          <ProfileSettings
            currentUser={currentUser}
            profileData={profileData}
            setProfileData={setProfileData}
            t={t}
            tc={tc}
            error={profileError}
          />
          <ChangePasswordCard t={t} tc={tc} />
        </div>
      ),
    },
    { key: "users", label: t("users_roles"), icon: Users, adminOnly: true, content: <UsersManagement /> },
    { key: "roles", label: t("roles_management"), icon: UserCog, adminOnly: true, content: <RolesManagement /> },
    {
      key: "organization",
      label: t("organization"),
      icon: Building,
      adminOnly: true,
      savable: true,
      content: <OrganizationSettings orgData={orgData} setOrgData={setOrgData} t={t} tc={tc} />,
    },
    {
      key: "modules",
      label: t("clinical_modules"),
      icon: LayoutTemplate,
      adminOnly: true,
      content: <ModuleConfiguration appModules={APP_MODULES} activeModules={activeModules} t={t} readOnly showOnlyActive />,
    },
    {
      key: "templates",
      label: ttpl("title"),
      icon: FileText,
      adminOnly: true,
      savable: true,
      content: (
        <DocumentTemplates
          facility={orgData}
          templateSettings={templateSettings}
          setTemplateSettings={setTemplateSettings}
          ttpl={ttpl}
        />
      ),
    },
    { key: "onprem_license", label: t("onprem_license_management"), icon: ServerCog, adminOnly: true, content: <OnPremLicensePanel /> },
    {
      key: "backup",
      label: t("backup.title"),
      icon: DatabaseBackup,
      adminOnly: true,
      separatorBefore: true,
      content: <DatabaseBackupSettings />,
    },
    {
      key: "integrations",
      label: t("integrations"),
      icon: Link2,
      adminOnly: true,
      content: (
        <>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">{t("integrations")}</h2>
            <p className="text-xs text-slate-500">{t(features.mobileMoneySettings ? "integrations_desc" : "integrations_desc_dhis2_only")}</p>
          </div>
          <Dhis2IntegrationSettings />
          {features.mobileMoneySettings && (
            <>
              <div className="mt-8 mb-4">
                <h2 className="text-lg font-bold text-slate-900">{t("payments.title")}</h2>
                <p className="text-xs text-slate-500">{t("payments.description")}</p>
              </div>
              <MobileMoneySettings />
            </>
          )}
        </>
      ),
    },
  ].filter((section) => !section.adminOnly || isSysAdmin);

  if (isMobile) {
    const openSection = (key: string) => {
      setMobileSelected(key);
      setActiveTab(key);
      scrollMobileContentToTop();
    };
    const closeSection = () => {
      setMobileSelected(null);
      scrollMobileContentToTop();
    };

    const selected = sections.find((section) => section.key === mobileSelected);

    if (selected) {
      return (
        <StandardMobileTemplate
          title={t("title")}
          subtitle={selected.label}
          actions={<SettingsMobileBackButton label={tnav("all_settings")} onClick={closeSection} />}
        >
          <div className="@container space-y-4">
            {selected.content}
            {/* handleSaveSettings persists only these sections; the others save through their own panels. */}
            {selected.savable && (
              <Button
                onClick={handleSaveSettings}
                disabled={isSaving || isLoading}
                className="h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {isSaving ? tc("saving") : tc("save_changes")}
              </Button>
            )}
          </div>
        </StandardMobileTemplate>
      );
    }

    const initials = (currentUser?.fullName ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");

    return (
      <StandardMobileTemplate title={t("title")} subtitle={t("description")}>
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => openSection("profile")}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {initials || <User className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{currentUser?.fullName ?? t("user_profile")}</span>
              <span className="block truncate text-xs text-slate-500">{currentUser?.email}</span>
              {currentUser?.role && (
                <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{currentUser.role}</span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </button>

          <SettingsMobileMenu
            sections={[
              {
                label: tnav("general"),
                entries: sections
                  .filter((section) => section.key !== "profile")
                  .map((section) => ({
                    key: section.key,
                    label: section.label,
                    icon: section.icon,
                    onSelect: () => openSection(section.key),
                  })),
              },
              ...(isSysAdmin
                ? navGroups.map((group) => ({
                    label: group.label,
                    entries: group.items.map((item) => ({ key: item.href, label: item.label, icon: item.icon, href: item.href })),
                  }))
                : []),
            ]}
          />
        </div>
      </StandardMobileTemplate>
    );
  }

  // Section list: a horizontally scrolling tab bar while the content area is narrow, a vertical
  // sidebar from @5xl (the container is the settings content area, not the viewport — the app
  // menu and the settings navigation already use part of the screen).
  const tabTriggerClass =
    "h-auto flex-none justify-start px-3 py-2 text-sm rounded-md text-slate-600 transition-all hover:bg-slate-100 data-active:bg-blue-50 data-active:text-blue-700 data-active:font-semibold data-active:shadow-none data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-semibold data-[state=active]:shadow-none @5xl:w-full @5xl:px-4 @5xl:py-2.5";

  return (
    <div className="flex h-full w-full flex-col gap-4 pb-8">
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-3 py-3 @xl:flex-row @xl:items-center @xl:justify-between sm:px-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('description')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin self-center text-slate-400" />}
          <Button onClick={handleSaveSettings} disabled={isSaving || isLoading} className="h-9 w-full bg-blue-600 text-xs text-white hover:bg-blue-700 @xl:h-8 @xl:w-auto">
            {isSaving ? tc('saving') : tc('save_changes')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue={initialTab} onValueChange={setActiveTab} className="flex w-full flex-1 flex-col gap-4 @5xl:flex-row @5xl:items-start @5xl:gap-8">
        <TabsList className="flex h-auto w-full flex-row items-stretch justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto @5xl:w-64 @5xl:shrink-0 @5xl:flex-col @5xl:space-y-1 @5xl:overflow-visible">
          {sections.map((section) => (
            <Fragment key={section.key}>
              {section.separatorBefore && <div className="mx-1 my-auto h-6 w-px shrink-0 bg-slate-200 @5xl:mx-2 @5xl:my-4 @5xl:h-px @5xl:w-auto" />}
              <TabsTrigger value={section.key} className={tabTriggerClass}>
                <section.icon className="mr-2 h-4 w-4 shrink-0 @5xl:mr-3" /> {section.label}
              </TabsTrigger>
            </Fragment>
          ))}
        </TabsList>

        <div className="min-w-0 flex-1">
          {sections.map((section) => (
            <TabsContent key={section.key} value={section.key} className="m-0 mt-0 focus-visible:outline-none">
              {section.content}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
