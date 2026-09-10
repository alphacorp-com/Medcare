"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Search, Plus, HeartPulse, Baby } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { NewPregnancySheet } from "./_components/NewPregnancySheet";
import { gestationalAgeFromLmp, PregnancyListItem, PregnancyStatus } from "./types";

const FILTERS: (PregnancyStatus | "All")[] = ["All", "ongoing", "delivered", "miscarried", "terminated"];

export default function MaternityPage() {
  const t = useTranslations('maternity');
  const tc = useTranslations('common');
  const hasModule = useAppStore((state) => state.hasModule);
  const router = useRouter();

  const [filter, setFilter] = useState<PregnancyStatus | "All">("ongoing");
  const [search, setSearch] = useState("");
  const [pregnancies, setPregnancies] = useState<PregnancyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const fetchPregnancies = async () => {
    try {
      const res = await fetch('/api/v1/maternity/pregnancies');
      const data = await res.json();
      setPregnancies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch pregnancies", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasModule("MODULE_MATERNITY")) return;
    (async () => {
      await fetchPregnancies();
    })();
  }, [hasModule]);

  if (!hasModule("MODULE_MATERNITY")) {
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

  const filtered = pregnancies.filter((p) => {
    if (filter !== "All" && p.status !== filter) return false;
    const patientName = `${p.patient.firstName} ${p.patient.lastName}`.toLowerCase();
    if (search && !patientName.includes(search.toLowerCase()) && !p.patient.ipp.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const count = (s: PregnancyStatus) => pregnancies.filter((p) => p.status === s).length;
  const dueSoonCount = pregnancies.filter((p) => {
    if (p.status !== "ongoing") return false;
    const days = (new Date(p.expectedDueDate).getTime() - now) / (24 * 60 * 60 * 1000);
    return days >= 0 && days <= 14;
  }).length;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} size="sm" className="bg-pink-600 hover:bg-pink-700 text-white h-8 text-xs">
          <Plus className="mr-2 h-3.5 w-3.5" /> {t('new_pregnancy')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-pink-300 transition-colors cursor-pointer" onClick={() => setFilter("ongoing")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('ongoing')}</div>
            <div className="text-3xl font-bold text-slate-900">{count('ongoing')}</div>
          </div>
          <HeartPulse className="h-8 w-8 text-pink-200" />
        </div>
        <div className="bg-orange-50 p-4 rounded border border-orange-200 shadow-sm flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">{t('due_soon')}</div>
            <div className="text-3xl font-bold text-orange-700">{dueSoonCount}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-green-300 transition-colors cursor-pointer" onClick={() => setFilter("delivered")}>
          <div>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">{t('delivered')}</div>
            <div className="text-3xl font-bold text-green-600">{count('delivered')}</div>
          </div>
          <Baby className="h-8 w-8 text-green-200" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{tc('all')}</div>
            <div className="text-3xl font-bold text-slate-900">{pregnancies.length}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
           <div className="relative w-96 flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder={tc('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
              />
            </div>
            <div className="flex bg-slate-200/50 p-1 rounded-md ml-4">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === f ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}
                >
                  {f === "All" ? tc('all') : t(f)}
                </button>
              ))}
            </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{t('patient')}</th>
                <th className="px-4 py-2">{t('gestational_age')}</th>
                <th className="px-4 py-2">{t('expected_due_date')}</th>
                <th className="px-4 py-2">{t('last_visit')}</th>
                <th className="px-4 py-2">{tc('status')}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">{tc('loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500 text-xs">{tc('no_data')}</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="hover:bg-pink-50/50 cursor-pointer" onClick={() => router.push(`/maternity/${p.id}`)}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {p.patient.firstName} {p.patient.lastName} <span className="text-[10px] font-mono text-slate-400">({p.patient.ipp})</span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{t('weeks', { count: gestationalAgeFromLmp(p.lastMenstrualPeriod) })}</td>
                  <td className="px-4 py-2 text-slate-700">{format(new Date(p.expectedDueDate), "PPP")}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {p.antenatalVisits[0] ? t('visit_n', { n: p.antenatalVisits[0].visitNumber }) : t('no_visits_yet')}
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn(
                       "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                       p.status === 'ongoing' ? "bg-blue-100 text-blue-700" :
                       p.status === 'delivered' ? "bg-green-100 text-green-700" :
                       "bg-red-100 text-red-700"
                    )}>
                      {t(p.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewPregnancySheet open={isNewOpen} onOpenChange={setIsNewOpen} onCreated={fetchPregnancies} />
    </div>
  );
}
