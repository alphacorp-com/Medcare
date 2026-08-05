"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Link } from "@/i18n/routing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AntenatalVisitsTab } from "./_components/AntenatalVisitsTab";
import { DeliveryTab } from "./_components/DeliveryTab";
import { NewbornsTab } from "./_components/NewbornsTab";
import { gestationalAgeFromLmp, PregnancyDetail } from "../types";

export default function PregnancyDetailPage() {
  const t = useTranslations("maternity");
  const params = useParams();
  const id = params.id as string;

  const [pregnancy, setPregnancy] = useState<PregnancyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPregnancy = async () => {
    try {
      const res = await fetch(`/api/v1/maternity/pregnancies/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load pregnancy");
      setPregnancy(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pregnancy");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchPregnancy();
    })();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !pregnancy) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-sm">{error || t("pregnancy_not_found")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/maternity" className="p-2 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 text-slate-500 transition-all active:scale-95">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {pregnancy.patient.firstName} {pregnancy.patient.lastName}
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] rounded-full uppercase font-bold tracking-wider bg-pink-100 text-pink-700 ring-1 ring-pink-200">
                {t(pregnancy.status)}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
              <span className="font-mono">IPP: {pregnancy.patient.ipp}</span>
              <span className="text-slate-300">|</span>
              <span>{t("gravida_para", { g: pregnancy.gravida, p: pregnancy.para })}</span>
              <span className="text-slate-300">|</span>
              <span>{t("weeks", { count: gestationalAgeFromLmp(pregnancy.lastMenstrualPeriod) })}</span>
              <span className="text-slate-300">|</span>
              <span>{t("expected_due_date")}: {format(new Date(pregnancy.expectedDueDate), "PPP")}</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="visits" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="bg-white border border-slate-200 shadow-sm h-auto p-1 w-fit shrink-0">
          <TabsTrigger value="visits" className="text-xs data-[state=active]:bg-pink-50 data-[state=active]:text-pink-700">
            {t("antenatal_visits")}
          </TabsTrigger>
          <TabsTrigger value="delivery" className="text-xs data-[state=active]:bg-pink-50 data-[state=active]:text-pink-700">
            {t("delivery_partograph")}
          </TabsTrigger>
          <TabsTrigger value="newborns" className="text-xs data-[state=active]:bg-pink-50 data-[state=active]:text-pink-700">
            {t("newborns")}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto mt-4">
          <TabsContent value="visits" className="m-0">
            <AntenatalVisitsTab pregnancy={pregnancy} onUpdated={fetchPregnancy} />
          </TabsContent>
          <TabsContent value="delivery" className="m-0">
            <DeliveryTab pregnancy={pregnancy} onUpdated={fetchPregnancy} />
          </TabsContent>
          <TabsContent value="newborns" className="m-0">
            <NewbornsTab pregnancy={pregnancy} onUpdated={fetchPregnancy} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
