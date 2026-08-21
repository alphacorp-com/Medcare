"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { TriageBadge, type TriageAcuity } from "@/components/shared/triage-badge";
import { Button } from "@/components/ui/button";

interface QueueItem {
  id: string;
  patientId: string;
  ipp: string;
  name: string;
  type: string;
  triageAcuity: TriageAcuity | null;
  consultationStatus: "waiting" | "claimed" | "completed";
  waitingMinutes: number;
  claimedBy: { id: string; fullName: string } | null;
  isMine: boolean;
}

export default function ConsultationsPage() {
  const t = useTranslations("consultations");
  const ta = useTranslations("admissions");
  const tc = useTranslations("common");
  const router = useRouter();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/consultations/queue");
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || t("failed_load"));
      setQueue(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("unknown_error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const goToConsultation = (item: QueueItem) => {
    router.push(`/patients/${item.patientId}?openConsultation=1&stayId=${item.id}`);
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

  return (
    <div className="flex flex-col bg-white rounded border border-slate-200 shadow-sm h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200">
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
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0">
                <th className="px-4 py-2">{tc("ipp")}</th>
                <th className="px-4 py-2">{t("column_patient")}</th>
                <th className="px-4 py-2">{t("column_type")}</th>
                <th className="px-4 py-2">{t("column_wait")}</th>
                <th className="px-4 py-2">{t("column_status")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-mono">#{item.ipp}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">
                    {item.triageAcuity ? (
                      <TriageBadge acuity={item.triageAcuity} />
                    ) : (
                      <span className="text-slate-600">{ta(`type_${item.type}`)}</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${item.waitingMinutes > 60 ? "text-red-600 font-medium" : ""}`}>
                    {formatWaitingTime(item.waitingMinutes)}
                  </td>
                  <td className="px-4 py-3">
                    {item.consultationStatus === "waiting" ? (
                      <span className="text-slate-500">{tc("active")}</span>
                    ) : (
                      <span className="text-slate-500">
                        {t("claimed_by", { name: item.claimedBy?.fullName ?? "" })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.consultationStatus === "waiting" ? (
                      <Button size="sm" onClick={() => handleClaim(item)} disabled={claimingId === item.id}>
                        {t("claim")}
                      </Button>
                    ) : item.isMine ? (
                      <Button size="sm" variant="outline" onClick={() => goToConsultation(item)}>
                        {t("continue")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled>
                        {t("continue")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
