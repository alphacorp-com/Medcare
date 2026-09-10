"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Baby, CheckCircle2, Loader2, Plus } from "lucide-react";
import { PartographChart } from "./PartographChart";
import { PartographEntryDialog } from "./PartographEntryDialog";
import { CompleteDeliveryDialog } from "./CompleteDeliveryDialog";
import { PregnancyDetail } from "../../types";

export function DeliveryTab({
  pregnancy,
  onUpdated,
}: {
  pregnancy: PregnancyDetail;
  onUpdated: () => void;
}) {
  const t = useTranslations("maternity");

  const [isStarting, setIsStarting] = useState(false);
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delivery = pregnancy.delivery;

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/maternity/pregnancies/${pregnancy.id}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("start_delivery_error"));
        return;
      }
      onUpdated();
    } catch (err) {
      setError(t("start_delivery_error"));
    } finally {
      setIsStarting(false);
    }
  };

  if (!delivery) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
        )}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
          <Baby className="h-10 w-10 text-pink-200 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">{t("no_delivery_yet")}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{t("no_delivery_yet_desc")}</p>
          <Button className="mt-4 text-xs h-8 bg-pink-600 hover:bg-pink-700" disabled={isStarting} onClick={handleStart}>
            {isStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
            {t("start_delivery")}
          </Button>
        </div>
      </div>
    );
  }

  const isCompleted = Boolean(delivery.deliveryDate);

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      {isCompleted ? (
        <div className="bg-green-50 border border-green-200 rounded p-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4" /> {t("delivery_completed")}
            </div>
            <p className="text-xs text-green-700 mt-1">
              {t("delivery_summary", {
                mode: delivery.mode ? t(`mode_${delivery.mode}`) : "—",
                date: delivery.deliveryDate ? format(new Date(delivery.deliveryDate), "PPP 'at' p") : "—",
              })}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsEntryOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_partograph_entry")}
          </Button>
          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => setIsCompleteOpen(true)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> {t("complete_delivery")}
          </Button>
        </div>
      )}

      <PartographChart entries={delivery.partograph} />

      <PartographEntryDialog
        open={isEntryOpen}
        onOpenChange={setIsEntryOpen}
        deliveryId={delivery.id}
        onSaved={onUpdated}
      />
      <CompleteDeliveryDialog
        open={isCompleteOpen}
        onOpenChange={setIsCompleteOpen}
        deliveryId={delivery.id}
        onSaved={onUpdated}
      />
    </div>
  );
}
