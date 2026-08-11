"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Syringe, ShieldAlert, Cross } from "lucide-react";

type PatientRef = { id: string; firstName: string; lastName: string; ipp: string };
type ImmunizationItem = { id: string; antigenName: string; doseNumber: number; administeredAt: string; patient: PatientRef };
type MalariaCaseItem = { id: string; testType: string; result: string; diagnosedAt: string; treatedWithAct: boolean; patient: PatientRef };
type TbCaseItem = { id: string; classification: string; outcome: string; notificationDate: string; patient: PatientRef };

export default function DiseaseProgramsPage() {
  const t = useTranslations('diseasePrograms');
  const tc = useTranslations('common');
  const hasModule = useAppStore((state) => state.hasModule);

  const [immunizations, setImmunizations] = useState<ImmunizationItem[]>([]);
  const [malariaCases, setMalariaCases] = useState<MalariaCaseItem[]>([]);
  const [tbCases, setTbCases] = useState<TbCaseItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">{t('module_title')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('module_desc')}</p>
      </div>

      <div className="flex-1 bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <Tabs defaultValue="vaccination" className="flex-1 flex flex-col">
          <div className="px-2 pt-2 border-b border-slate-200 bg-slate-50 shrink-0">
            <TabsList className="h-9 bg-transparent p-0 flex gap-4">
              <TabsTrigger value="vaccination" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs">
                <Syringe className="h-3.5 w-3.5 mr-2" /> {t('vaccination.tab')}
              </TabsTrigger>
              <TabsTrigger value="malaria" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs">
                <ShieldAlert className="h-3.5 w-3.5 mr-2" /> {t('malaria.tab')}
              </TabsTrigger>
              <TabsTrigger value="tuberculosis" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs">
                <Cross className="h-3.5 w-3.5 mr-2" /> {t('tuberculosis.tab')}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            <TabsContent value="vaccination" className="m-0 border-none outline-none">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0">
                    <th className="px-4 py-2">{tc('date')}</th>
                    <th className="px-4 py-2">{tc('patient')}</th>
                    <th className="px-4 py-2">{t('vaccination.antigen')}</th>
                    <th className="px-4 py-2">{t('vaccination.dose_number')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {!loading && immunizations.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500 italic">{t('vaccination.no_items')}</td></tr>
                  )}
                  {immunizations.map((im) => (
                    <tr key={im.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{format(new Date(im.administeredAt), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <Link href={`/patients/${im.patient.id}`} className="text-blue-600 hover:underline font-medium">
                          {im.patient.firstName} {im.patient.lastName}
                        </Link>
                        <span className="block text-[10px] text-slate-400 font-mono">{im.patient.ipp}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{im.antigenName}</td>
                      <td className="px-4 py-3">{im.doseNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="malaria" className="m-0 border-none outline-none">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0">
                    <th className="px-4 py-2">{tc('date')}</th>
                    <th className="px-4 py-2">{tc('patient')}</th>
                    <th className="px-4 py-2">{t('malaria.test_type')}</th>
                    <th className="px-4 py-2">{t('malaria.result')}</th>
                    <th className="px-4 py-2">{t('malaria.treated_with_act')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {!loading && malariaCases.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('malaria.no_items')}</td></tr>
                  )}
                  {malariaCases.map((mc) => (
                    <tr key={mc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{format(new Date(mc.diagnosedAt), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <Link href={`/patients/${mc.patient.id}`} className="text-blue-600 hover:underline font-medium">
                          {mc.patient.firstName} {mc.patient.lastName}
                        </Link>
                        <span className="block text-[10px] text-slate-400 font-mono">{mc.patient.ipp}</span>
                      </td>
                      <td className="px-4 py-3">{t(`malaria.test_${mc.testType}`)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                          mc.result === 'positive' ? "bg-red-100 text-red-700" :
                          mc.result === 'negative' ? "bg-green-100 text-green-700" :
                          "bg-slate-100 text-slate-600")}>
                          {t(`malaria.result_${mc.result}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{mc.treatedWithAct ? tc('yes') : tc('no')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="tuberculosis" className="m-0 border-none outline-none">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0">
                    <th className="px-4 py-2">{tc('date')}</th>
                    <th className="px-4 py-2">{tc('patient')}</th>
                    <th className="px-4 py-2">{t('tuberculosis.classification')}</th>
                    <th className="px-4 py-2">{t('tuberculosis.outcome_label')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {!loading && tbCases.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500 italic">{t('tuberculosis.no_items')}</td></tr>
                  )}
                  {tbCases.map((tb) => (
                    <tr key={tb.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{format(new Date(tb.notificationDate), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <Link href={`/patients/${tb.patient.id}`} className="text-blue-600 hover:underline font-medium">
                          {tb.patient.firstName} {tb.patient.lastName}
                        </Link>
                        <span className="block text-[10px] text-slate-400 font-mono">{tb.patient.ipp}</span>
                      </td>
                      <td className="px-4 py-3">
                        {tb.classification === 'pulmonary_bacteriologically_confirmed' ? t('tuberculosis.tpb_plus') :
                          tb.classification === 'pulmonary_clinically_diagnosed' ? t('tuberculosis.tpb_minus') : t('tuberculosis.tep')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                          tb.outcome === 'cured' || tb.outcome === 'treatment_completed' ? "bg-green-100 text-green-700" :
                          tb.outcome === 'on_treatment' ? "bg-blue-100 text-blue-700" :
                          tb.outcome === 'died' || tb.outcome === 'treatment_failed' ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-600")}>
                          {t(`tuberculosis.outcome.${tb.outcome}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
