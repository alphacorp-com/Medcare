"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { FeeScheduleFormDialog } from "./FeeScheduleFormDialog";
import { FeeScheduleItem } from "../types";

export function FeeScheduleTab() {
  const t = useTranslations("billing");

  const [fees, setFees] = useState<FeeScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchFees = async () => {
    try {
      const res = await fetch("/api/v1/billing/fee-schedule");
      const json = await res.json();
      setFees(Array.isArray(json) ? json : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchFees();
    })();
  }, []);

  const toggleActive = async (fee: FeeScheduleItem) => {
    await fetch(`/api/v1/billing/fee-schedule/${fee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !fee.isActive }),
    });
    fetchFees();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <p className="text-xs text-slate-500 px-2">{t("fee_schedule_desc")}</p>
        <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => setIsFormOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_tariff")}
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
              <th className="px-4 py-2">{t("source_type")}</th>
              <th className="px-4 py-2">{t("tariff_code")}</th>
              <th className="px-4 py-2">{t("tariff_label")}</th>
              <th className="px-4 py-2 text-right">{t("unit_price")}</th>
              <th className="px-4 py-2 text-right">{t("active")}</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-slate-100">
            {fees.map((fee) => (
              <tr key={fee.id} className="hover:bg-blue-50/50">
                <td className="px-4 py-2 text-slate-600">{t(`source_${fee.sourceType}`)}</td>
                <td className="px-4 py-2 font-mono text-slate-900 font-semibold">{fee.code}</td>
                <td className="px-4 py-2 text-slate-700">{fee.label}</td>
                <td className="px-4 py-2 text-right font-mono">{Number(fee.unitPrice).toLocaleString()} XAF</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => toggleActive(fee)}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${fee.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {fee.isActive ? t("active") : t("inactive")}
                  </button>
                </td>
              </tr>
            ))}
            {fees.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500 text-xs">{t("no_fee_schedule")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FeeScheduleFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} onSaved={fetchFees} />
    </div>
  );
}
