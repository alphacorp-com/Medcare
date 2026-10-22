"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Baby, Plus } from "lucide-react";
import { NewNewbornDialog } from "./NewNewbornDialog";
import { NewbornFollowUpDialog } from "./NewbornFollowUpDialog";
import { Newborn, PregnancyDetail } from "../../types";

export function NewbornsTab({
  pregnancy,
  onUpdated,
}: {
  pregnancy: PregnancyDetail;
  onUpdated: () => void;
}) {
  const t = useTranslations("maternity");
  const [isOpen, setIsOpen] = useState(false);
  const [followUp, setFollowUp] = useState<Newborn | null>(null);

  const delivery = pregnancy.delivery;

  if (!delivery || !delivery.deliveryDate) {
    return (
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
        <Baby className="h-10 w-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-500">{t("complete_delivery_first")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{t("newborns")}</h3>
        <Button size="sm" className="h-8 text-xs bg-pink-600 hover:bg-pink-700" onClick={() => setIsOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-2" /> {t("register_newborn")}
        </Button>
      </div>

      {delivery.newborns.length === 0 ? (
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10 text-slate-400 italic text-xs">
          {t("no_newborns_yet")}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {delivery.newborns.map((n) => (
            <div key={n.id} className="bg-white rounded border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-slate-900">
                  {n.patient ? (
                    <Link href={`/patients/${n.patient.id}`} className="hover:underline text-pink-700">
                      {n.patient.firstName} {n.patient.lastName}
                    </Link>
                  ) : (
                    t("newborn")
                  )}
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-600">
                  {t(n.sex === "M" ? "sex_male" : "sex_female")}
                </span>
              </div>
              {n.patient && <div className="text-[10px] font-mono text-slate-400 mb-2">IPP: {n.patient.ipp}</div>}
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                <div>
                  <div className="text-[10px] text-slate-400">{t("birth_weight_g")}</div>
                  <div className="font-semibold">{n.birthWeightGrams ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">{t("apgar_1min")}</div>
                  <div className="font-semibold">{n.apgarScore1Min ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">{t("apgar_5min")}</div>
                  <div className="font-semibold">{n.apgarScore5Min ?? "—"}</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {n.vitaminKGiven && <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[9px] font-bold uppercase">{t("vitamin_k_given")}</span>}
                {n.kangarooCare && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold uppercase">{t("kangaroo_care")}</span>}
                {n.incubatorCare && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold uppercase">{t("incubator_care")}</span>}
                {n.outcome === "stillbirth" && (
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold uppercase">
                    {t("outcome_stillbirth")}
                    {n.stillbirthType ? ` · ${t(`stillbirth_${n.stillbirthType}`)}` : ""}
                  </span>
                )}
                {n.outcome === "neonatal_death" && (
                  <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[9px] font-bold uppercase">
                    {t("outcome_neonatal_death")}
                    {n.deathCause ? ` · ${t(`neonatal_cause_${n.deathCause}`)}` : ""}
                    {n.deathReviewedAt ? ` · ${t("death_reviewed")}` : ""}
                  </span>
                )}
              </div>
              {n.outcome !== "stillbirth" && (
                <Button size="sm" variant="outline" className="mt-3 h-7 text-[11px]" onClick={() => setFollowUp(n)}>
                  {t("newborn_follow_up")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <NewNewbornDialog open={isOpen} onOpenChange={setIsOpen} deliveryId={delivery.id} onSaved={onUpdated} />
      {followUp && <NewbornFollowUpDialog newborn={followUp} onOpenChange={(open) => !open && setFollowUp(null)} onSaved={onUpdated} />}
    </div>
  );
}
