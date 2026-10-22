"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useUrlTab } from "@/hooks/use-url-tab";
import { useAppStore } from "@/lib/store/useAppStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthlyFormTab } from "./_components/MonthlyFormTab";
import { IdentificationTab } from "./_components/IdentificationTab";

// RMA3 monthly form (MODULE_RMA3): what no transaction of the app records, entered once a
// month and validated, plus the MINSANTE identification. Merged into the RMA3 Word report.
function Rma3EntryPageContent() {
  const t = useTranslations("rma3Entry");
  const canRead = useAppStore((state) => state.hasPermission("MODULE_RMA3", "read"));
  const [tab, setTab] = useUrlTab(["form", "identification"] as const, "form");

  if (!canRead) return <p className="p-6 text-sm text-slate-500">{t("no_access")}</p>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
        <p className="text-xs text-slate-500">{t("subtitle")}</p>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="form">{t("tab_form")}</TabsTrigger>
          <TabsTrigger value="identification">{t("tab_identification")}</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="pt-4">
          <MonthlyFormTab />
        </TabsContent>
        <TabsContent value="identification" className="pt-4">
          <IdentificationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The active tab lives in the URL (?tab=, see useUrlTab), which needs a Suspense boundary.
export default function Rma3EntryPage() {
  return (
    <Suspense fallback={null}>
      <Rma3EntryPageContent />
    </Suspense>
  );
}
