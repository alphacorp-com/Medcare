"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { TriageBadge, type TriageAcuity } from "@/components/shared/triage-badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  patientId: string;
  ipp: string;
  name: string;
  type: string;
  triageAcuity: TriageAcuity | null;
  admissionReason: string | null;
  consultationStatus: "awaiting_payment" | "waiting" | "claimed" | "completed";
  waitingMinutes: number;
  claimedBy: { id: string; fullName: string } | null;
  isMine: boolean;
}

export default function ConsultationsPage() {
  const t = useTranslations("consultations");
  const ta = useTranslations("admissions");
  const tc = useTranslations("common");
  const router = useRouter();
  const isMobile = useIsMobile();

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Refreshed every 30 s, paused while the tab is hidden; a failed refresh keeps the
  // last good list on screen.
  const queueQuery = useQuery({
    queryKey: ["consultations", "queue"],
    queryFn: () => apiFetch<{ data: QueueItem[] }>("/api/v1/consultations/queue"),
    refetchInterval: 30_000,
  });
  const queue = queueQuery.data?.data ?? [];
  const loading = queueQuery.isPending;
  const error = queueQuery.isError && !queueQuery.data ? queueQuery.error.message || t("failed_load") : null;
  const fetchQueue = () => queryClient.invalidateQueries({ queryKey: ["consultations", "queue"] });

  const goToConsultation = (item: QueueItem) => {
    router.push(`/consultations/${item.id}`);
  };

  const handleClaim = async (item: QueueItem) => {
    setClaimingId(item.id);
    try {
      const res = await fetch(`/api/v1/stays/${item.id}/claim`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        window.alert(res.status === 409 ? t("already_claimed") : result.error || t("claim_failed"));
        await fetchQueue();
        return;
      }
      goToConsultation(item);
    } catch {
      window.alert(t("claim_failed"));
    } finally {
      setClaimingId(null);
    }
  };

  const formatWaitingTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Shared by the desktop table and the mobile cards.
  const renderType = (item: QueueItem) =>
    item.triageAcuity ? (
      <TriageBadge acuity={item.triageAcuity} />
    ) : (
      <span className="text-slate-600">{ta(`type_${item.type}`)}</span>
    );

  const renderStatus = (item: QueueItem) =>
    item.consultationStatus === "awaiting_payment" ? (
      <span className="font-medium text-amber-700">{t("status_awaiting_payment")}</span>
    ) : item.consultationStatus === "waiting" ? (
      tc("active")
    ) : (
      t("claimed_by", { name: item.claimedBy?.fullName ?? "" })
    );

  const renderAction = (item: QueueItem, className?: string) =>
    item.consultationStatus === "awaiting_payment" ? (
      <Button size="sm" variant="ghost" className={className} disabled>
        {t("claim")}
      </Button>
    ) : item.consultationStatus === "waiting" ? (
      <Button size="sm" className={className} onClick={() => handleClaim(item)} disabled={claimingId === item.id}>
        {t("claim")}
      </Button>
    ) : item.isMine ? (
      <Button size="sm" variant="outline" className={className} onClick={() => goToConsultation(item)}>
        {t("continue")}
      </Button>
    ) : (
      <Button size="sm" variant="ghost" className={className} disabled>
        {t("continue")}
      </Button>
    );

  return (
    <div className="flex flex-col bg-white rounded border border-slate-200 shadow-sm h-full overflow-hidden">
      <div className="p-3 md:p-4 border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
        <p className="text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm animate-pulse">{t("loading")}</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-sm">{error}</div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">{t("no_patients")}</div>
        ) : isMobile ? (
          <div className="space-y-3 p-3">
            {queue.map((item) => (
              <div key={item.id} className={cn("rounded-2xl border border-slate-200 bg-white p-3 shadow-sm", item.consultationStatus === "awaiting_payment" && "opacity-70")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="font-mono text-[11px] text-slate-500">#{item.ipp}</p>
                  </div>
                  <div className="shrink-0 text-xs">{renderType(item)}</div>
                </div>
                {item.admissionReason && <p className="mt-2 line-clamp-2 text-xs text-slate-600">{item.admissionReason}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className={cn("inline-flex items-center gap-1", item.waitingMinutes > 60 && "font-semibold text-red-600")}>
                    <Clock className="h-3.5 w-3.5" /> {formatWaitingTime(item.waitingMinutes)}
                  </span>
                  <span className="truncate">{renderStatus(item)}</span>
                </div>
                <div className="mt-3">{renderAction(item, "h-10 w-full rounded-xl")}</div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0">
                <th className="px-4 py-2">{tc("ipp")}</th>
                <th className="px-4 py-2">{t("column_patient")}</th>
                <th className="px-4 py-2">{t("column_type")}</th>
                <th className="px-4 py-2">{t("column_reason")}</th>
                <th className="px-4 py-2">{t("column_wait")}</th>
                <th className="px-4 py-2">{t("column_status")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {queue.map((item) => (
                <tr key={item.id} className={cn("hover:bg-blue-50/50", item.consultationStatus === "awaiting_payment" && "opacity-70")}>
                  <td className="px-4 py-3 font-mono">#{item.ipp}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{renderType(item)}</td>
                  <td className="px-4 py-3 max-w-[240px] truncate text-slate-600" title={item.admissionReason ?? undefined}>
                    {item.admissionReason ?? "—"}
                  </td>
                  <td className={`px-4 py-3 ${item.waitingMinutes > 60 ? "text-red-600 font-medium" : ""}`}>
                    {formatWaitingTime(item.waitingMinutes)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-500">{renderStatus(item)}</span>
                  </td>
                  <td className="px-4 py-3">{renderAction(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
