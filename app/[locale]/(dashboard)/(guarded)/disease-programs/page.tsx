"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { useUrlTab } from "@/hooks/use-url-tab";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Syringe, ShieldAlert, Cross, CalendarDays, Thermometer, TriangleAlert } from "lucide-react";
import { SessionsTab } from "./_components/SessionsTab";
import { ColdChainTab } from "./_components/ColdChainTab";
import { AefiTab } from "./_components/AefiTab";
import { HivProgramTab } from "./_components/HivProgramTab";
import { NutritionTab } from "./_components/NutritionTab";
import { OxygenTab } from "./_components/OxygenTab";
import { ChronicCareTab } from "./_components/ChronicCareTab";
import { TbCaseComplementsDialog, TbScreeningPanel, type TbCaseComplementsItem } from "./_components/TbPanels";
import { HeartPulse, Apple, Wind, Activity } from "lucide-react";

type PatientRef = { id: string; firstName: string; lastName: string; ipp: string };
type ImmunizationItem = { id: string; antigenName: string; doseNumber: number; administeredAt: string; patient: PatientRef };
type MalariaCaseItem = { id: string; testType: string; result: string; diagnosedAt: string; treatedWithAct: boolean; patient: PatientRef };
type TbCaseItem = TbCaseComplementsItem & { classification: string; outcome: string; notificationDate: string; patient: PatientRef };

function DiseaseProgramsPageContent() {
  const t = useTranslations('diseasePrograms');
  const tc = useTranslations('common');
  const hasModule = useAppStore((state) => state.hasModule);
  const hasPermission = useAppStore((state) => state.hasPermission);
  // UI only: every EPI route checks the permission server-side.
  const canEdit = hasPermission("MODULE_DISEASE_PROGRAMS", "create");
  // HIV / hepatitis data: only for staff granted MODULE_HIV (the routes check it too).
  const canReadHiv = hasPermission("MODULE_HIV", "read");
  const [tab, setTab] = useUrlTab(["vaccination", "malaria", "tuberculosis", "sessions", "cold-chain", "aefi", "nutrition", "oxygen", "chronic", "hiv"] as const, "vaccination");
  // The HIV tab is only shown with MODULE_HIV: a link to it falls back to vaccination.
  const activeTab = tab === "hiv" && !canReadHiv ? "vaccination" : tab;

  const [immunizations, setImmunizations] = useState<ImmunizationItem[]>([]);
  const [malariaCases, setMalariaCases] = useState<MalariaCaseItem[]>([]);
  const [tbCases, setTbCases] = useState<TbCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTbCase, setEditingTbCase] = useState<TbCaseItem | null>(null);
  const canUpdate = hasPermission("MODULE_DISEASE_PROGRAMS", "update");

  const reloadTbCases = async () => {
    const json = await (await fetch("/api/v1/tb-cases")).json();
    if (json.success) setTbCases(json.data);
  };

  useEffect(() => {
    if (!hasModule("MODULE_DISEASE_PROGRAMS")) return;
    (async () => {
      try {
        const [immRes, malRes, tbRes] = await Promise.all([
          fetch('/api/v1/immunizations'),
          fetch('/api/v1/malaria-cases'),
          fetch('/api/v1/tb-cases'),
        ]);
        const [immJson, malJson, tbJson] = await Promise.all([immRes.json(), malRes.json(), tbRes.json()]);
        if (immJson.success) setImmunizations(immJson.data);
        if (malJson.success) setMalariaCases(malJson.data);
        if (tbJson.success) setTbCases(tbJson.data);
      } catch (err) {
        console.error("Failed to fetch disease program registries", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [hasModule]);

  if (!hasModule("MODULE_DISEASE_PROGRAMS")) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tc('restricted_access')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('module_desc')}</p>
          <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
            {tc('contact_admin')}
          </p>
        </div>
      </div>
    );
  }

  const summaryItems = [
    { label: t('vaccination.tab'), count: immunizations.length, icon: Syringe, className: 'text-violet-600 bg-violet-50 border-violet-100' },
    { label: t('malaria.tab'), count: malariaCases.length, icon: ShieldAlert, className: 'text-amber-600 bg-amber-50 border-amber-100' },
    { label: t('tuberculosis.tab'), count: tbCases.length, icon: Cross, className: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="mb-3 sm:mb-0">
          <h1 className="text-lg font-bold text-slate-800">{t('module_title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('module_desc')}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 shrink-0">
        {summaryItems.map(({ label, count, icon: Icon, className }) => (
          <div key={label} className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
              <div className="text-3xl font-bold text-slate-900">{count}</div>
            </div>
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center border', className)}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* min-h-0 down the flex chain lets the tab body below be the one that scrolls; min-h keeps it usable on short screens (the page then scrolls). */}
      <div className="flex-1 min-h-[28rem] bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 min-h-0 flex flex-col">
          <div className="px-2 pt-2 border-b border-slate-200 bg-slate-50 shrink-0">
            <TabsList className={TAB_LIST_CLASS}>
              <TabsTrigger value="vaccination" className={TAB_TRIGGER_CLASS}>
                <Syringe className="h-3.5 w-3.5 mr-2" /> {t('vaccination.tab')}
              </TabsTrigger>
              <TabsTrigger value="malaria" className={TAB_TRIGGER_CLASS}>
                <ShieldAlert className="h-3.5 w-3.5 mr-2" /> {t('malaria.tab')}
              </TabsTrigger>
              <TabsTrigger value="tuberculosis" className={TAB_TRIGGER_CLASS}>
                <Cross className="h-3.5 w-3.5 mr-2" /> {t('tuberculosis.tab')}
              </TabsTrigger>
              <TabsTrigger value="sessions" className={TAB_TRIGGER_CLASS}>
                <CalendarDays className="h-3.5 w-3.5 mr-2" /> {t('epi.sessions_tab')}
              </TabsTrigger>
              <TabsTrigger value="cold-chain" className={TAB_TRIGGER_CLASS}>
                <Thermometer className="h-3.5 w-3.5 mr-2" /> {t('epi.cold_chain_tab')}
              </TabsTrigger>
              <TabsTrigger value="aefi" className={TAB_TRIGGER_CLASS}>
                <TriangleAlert className="h-3.5 w-3.5 mr-2" /> {t('epi.aefi_tab')}
              </TabsTrigger>
              <TabsTrigger value="nutrition" className={TAB_TRIGGER_CLASS}>
                <Apple className="h-3.5 w-3.5 mr-2" /> {t('nutrition_tab')}
              </TabsTrigger>
              <TabsTrigger value="oxygen" className={TAB_TRIGGER_CLASS}>
                <Wind className="h-3.5 w-3.5 mr-2" /> {t('oxygen_tab')}
              </TabsTrigger>
              <TabsTrigger value="chronic" className={TAB_TRIGGER_CLASS}>
                <Activity className="h-3.5 w-3.5 mr-2" /> {t('chronic_tab')}
              </TabsTrigger>
              {canReadHiv && (
                <TabsTrigger value="hiv" className={TAB_TRIGGER_CLASS}>
                  <HeartPulse className="h-3.5 w-3.5 mr-2" /> {t('hiv.tab')}
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <TabsContent value="vaccination" className="m-0 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto">
                <div className="overflow-x-auto">
                  <table className="sm:min-w-[760px] w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                        <th className="p-4 font-semibold w-32">{tc('date')}</th>
                        <th className="p-4 font-semibold w-48">{tc('patient')}</th>
                        <th className="p-4 font-semibold">{t('vaccination.antigen')}</th>
                        <th className="p-4 font-semibold w-24">{t('vaccination.dose_number')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {loading ? (
                        <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">{tc('loading')}</td></tr>
                      ) : !loading && immunizations.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">{t('vaccination.no_items')}</td></tr>
                      ) : immunizations.map((im) => (
                        <tr key={im.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-sm text-slate-600">{format(new Date(im.administeredAt), "MMM d, yyyy")}</td>
                          <td className="p-4">
                            <Link href={`/patients/${im.patient.id}`} className="text-sm font-semibold text-blue-600 hover:underline">
                              {im.patient.firstName} {im.patient.lastName}
                            </Link>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{im.patient.ipp}</div>
                          </td>
                          <td className="p-4 text-sm font-medium text-slate-900">{im.antigenName}</td>
                          <td className="p-4 text-sm text-slate-700">{im.doseNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="malaria" className="m-0 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto">
                <div className="overflow-x-auto">
                  <table className="sm:min-w-[760px] w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                        <th className="p-4 font-semibold w-32">{tc('date')}</th>
                        <th className="p-4 font-semibold w-48">{tc('patient')}</th>
                        <th className="p-4 font-semibold">{t('malaria.test_type')}</th>
                        <th className="p-4 font-semibold w-32">{t('malaria.result')}</th>
                        <th className="p-4 font-semibold w-36">{t('malaria.treated_with_act')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {loading ? (
                        <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">{tc('loading')}</td></tr>
                      ) : !loading && malariaCases.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">{t('malaria.no_items')}</td></tr>
                      ) : malariaCases.map((mc) => (
                        <tr key={mc.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-sm text-slate-600">{format(new Date(mc.diagnosedAt), "MMM d, yyyy")}</td>
                          <td className="p-4">
                            <Link href={`/patients/${mc.patient.id}`} className="text-sm font-semibold text-blue-600 hover:underline">
                              {mc.patient.firstName} {mc.patient.lastName}
                            </Link>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{mc.patient.ipp}</div>
                          </td>
                          <td className="p-4 text-sm text-slate-700">{t(`malaria.test_${mc.testType}`)}</td>
                          <td className="p-4">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                              mc.result === 'positive' ? "bg-red-100 text-red-700" :
                              mc.result === 'negative' ? "bg-green-100 text-green-700" :
                              "bg-slate-100 text-slate-600")}>
                              {t(`malaria.result_${mc.result}`)}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-700">{mc.treatedWithAct ? tc('yes') : tc('no')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tuberculosis" className="m-0 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto">
                <div className="overflow-x-auto">
                  <table className="sm:min-w-[760px] w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                        <th className="p-4 font-semibold w-32">{tc('date')}</th>
                        <th className="p-4 font-semibold w-48">{tc('patient')}</th>
                        <th className="p-4 font-semibold">{t('tuberculosis.classification')}</th>
                        <th className="p-4 font-semibold w-40">{t('tuberculosis.outcome_label')}</th>
                        <th className="p-4 font-semibold w-28" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {loading ? (
                        <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">{tc('loading')}</td></tr>
                      ) : !loading && tbCases.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">{t('tuberculosis.no_items')}</td></tr>
                      ) : tbCases.map((tb) => (
                        <tr key={tb.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-sm text-slate-600">{format(new Date(tb.notificationDate), "MMM d, yyyy")}</td>
                          <td className="p-4">
                            <Link href={`/patients/${tb.patient.id}`} className="text-sm font-semibold text-blue-600 hover:underline">
                              {tb.patient.firstName} {tb.patient.lastName}
                            </Link>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{tb.patient.ipp}</div>
                          </td>
                          <td className="p-4 text-sm text-slate-700">
                            {tb.classification === 'pulmonary_bacteriologically_confirmed' ? t('tuberculosis.tpb_plus') :
                              tb.classification === 'pulmonary_clinically_diagnosed' ? t('tuberculosis.tpb_minus') : t('tuberculosis.tep')}
                          </td>
                          <td className="p-4">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                              tb.outcome === 'cured' || tb.outcome === 'treatment_completed' ? "bg-green-100 text-green-700" :
                              tb.outcome === 'on_treatment' ? "bg-blue-100 text-blue-700" :
                              tb.outcome === 'died' || tb.outcome === 'treatment_failed' ? "bg-red-100 text-red-700" :
                              "bg-slate-100 text-slate-600")}>
                              {t(`tuberculosis.outcome.${tb.outcome}`)}
                            </span>
                            {tb.rifampicinResistant && <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">TB-RR</span>}
                          </td>
                          <td className="p-4 text-right">
                            {canUpdate && (
                              <button type="button" onClick={() => setEditingTbCase(tb)} className="text-xs font-medium text-blue-600 hover:underline">
                                {t('tuberculosis.complements')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TbScreeningPanel canEdit={canEdit} />
              </div>
              {editingTbCase && <TbCaseComplementsDialog tbCase={editingTbCase} onClose={() => setEditingTbCase(null)} onSaved={reloadTbCases} />}
            </TabsContent>

            <TabsContent value="sessions" className="m-0 flex-1 flex flex-col overflow-hidden">
              <SessionsTab canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="cold-chain" className="m-0 flex-1 flex flex-col overflow-hidden">
              <ColdChainTab canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="aefi" className="m-0 flex-1 flex flex-col overflow-hidden">
              <AefiTab canEdit={hasPermission("MODULE_DISEASE_PROGRAMS", "update")} />
            </TabsContent>
            <TabsContent value="nutrition" className="m-0 flex-1 flex flex-col overflow-hidden">
              <NutritionTab canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="oxygen" className="m-0 flex-1 flex flex-col overflow-hidden">
              <OxygenTab canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="chronic" className="m-0 flex-1 flex flex-col overflow-hidden">
              <ChronicCareTab canEdit={canEdit} />
            </TabsContent>
            {canReadHiv && (
              <TabsContent value="hiv" className="m-0 flex-1 flex flex-col overflow-hidden">
                <HivProgramTab />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// The active tab lives in the URL (?tab=, see useUrlTab), which needs a Suspense boundary.
// The base TabsList is forced to h-8 (a group variant that "h-auto" alone does not beat), which let
// nine wrapped tabs overflow onto the table below. The explicit group-data variant overrides it.
// Phone: one row that scrolls sideways (the active tab is never pushed under the content);
// from md: wraps.
const TAB_LIST_CLASS =
  "h-auto group-data-horizontal/tabs:h-auto w-full justify-start gap-2 overflow-x-auto bg-transparent p-0 flex-nowrap md:flex-wrap md:overflow-visible";
const TAB_TRIGGER_CLASS =
  "h-9 flex-none shrink-0 rounded-b-none rounded-t-md border border-transparent px-3 text-xs data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent data-[state=active]:bg-white data-[state=active]:shadow-sm";

export default function DiseaseProgramsPage() {
  return (
    <Suspense fallback={null}>
      <DiseaseProgramsPageContent />
    </Suspense>
  );
}
