"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Send, RotateCw } from "lucide-react";
import { DHIS2_METRIC_KEYS, Dhis2Mapping, Dhis2MetricKey } from "@/lib/dhis2/types";
import { Dhis2EntityPicker } from "./dhis2-entity-picker";

interface Dhis2FormState {
  baseUrl: string;
  username: string;
  password: string;
  orgUnitId: string;
  dataSetId: string;
  mappings: Dhis2Mapping[];
  enabled: boolean;
}

interface Dhis2HistoryEntry {
  id: string;
  createdAt: string;
  period: string;
  status: "success" | "skipped" | "failed";
  dataValueCount?: number;
  unmappedMetrics?: string[];
  error?: string;
}

const EMPTY_FORM: Dhis2FormState = {
  baseUrl: "",
  username: "",
  password: "",
  orgUnitId: "",
  dataSetId: "",
  mappings: [],
  enabled: false,
};

function mappingFor(mappings: Dhis2Mapping[], metricKey: Dhis2MetricKey): Dhis2Mapping {
  return mappings.find((m) => m.metricKey === metricKey) ?? { metricKey, dataElementId: "" };
}

export function Dhis2IntegrationSettings() {
  const t = useTranslations("settings");

  const [form, setForm] = useState<Dhis2FormState>(EMPTY_FORM);
  const [hasPassword, setHasPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryingPeriod, setRetryingPeriod] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [history, setHistory] = useState<Dhis2HistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/v1/settings/dhis2");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setForm({
            baseUrl: data.baseUrl ?? "",
            username: data.username ?? "",
            password: "",
            orgUnitId: data.orgUnitId ?? "",
            dataSetId: data.dataSetId ?? "",
            mappings: data.mappings ?? [],
            enabled: Boolean(data.enabled),
          });
          setHasPassword(Boolean(data.hasPassword));
        }
      } catch (error) {
        console.error("Failed to fetch DHIS2 settings", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/v1/settings/dhis2/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch DHIS2 sync history", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchHistory();
    })();
  }, []);

  const updateMapping = (metricKey: Dhis2MetricKey, field: "dataElementId" | "categoryOptionComboId", value: string) => {
    setForm((prev) => {
      const others = prev.mappings.filter((m) => m.metricKey !== metricKey);
      const current = mappingFor(prev.mappings, metricKey);
      return { ...prev, mappings: [...others, { ...current, [field]: value }] };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/v1/settings/dhis2", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          username: form.username,
          password: form.password || undefined,
          orgUnitId: form.orgUnitId,
          dataSetId: form.dataSetId,
          mappings: form.mappings.filter((m) => m.dataElementId),
          enabled: form.enabled,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setSaveError(payload?.error || t("dhis2.save_error"));
        return;
      }
      setHasPassword(true);
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (error) {
      setSaveError(t("dhis2.save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const usingDraft = Boolean(form.baseUrl && form.username && form.password);
      const res = await fetch("/api/v1/settings/dhis2/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usingDraft ? { baseUrl: form.baseUrl, username: form.username, password: form.password } : {}),
      });
      const payload = await res.json();
      setTestResult({
        ok: Boolean(payload.ok),
        message: payload.ok ? t("dhis2.test_success", { name: payload.displayName || form.username }) : payload.error || t("dhis2.test_failed"),
      });
    } catch (error) {
      setTestResult({ ok: false, message: t("dhis2.test_failed") });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncNow = async (period?: string) => {
    if (period) setRetryingPeriod(period);
    else setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/v1/settings/dhis2/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(period ? { period } : {}),
      });
      const summary = await res.json();
      if (summary.status === "success") {
        setSyncResult({
          ok: true,
          message: t("dhis2.sync_success", {
            period: summary.period,
            imported: (summary.importCount?.imported ?? 0) + (summary.importCount?.updated ?? 0),
          }),
        });
      } else {
        setSyncResult({ ok: false, message: summary.error || t("dhis2.sync_failed") });
      }
      await fetchHistory();
    } catch (error) {
      setSyncResult({ ok: false, message: t("dhis2.sync_failed") });
    } finally {
      setIsSyncing(false);
      setRetryingPeriod(null);
    }
  };

  const historyStatusLabel = (status: Dhis2HistoryEntry["status"]) =>
    status === "success" ? t("dhis2.history_status_success") : status === "skipped" ? t("dhis2.history_status_skipped") : t("dhis2.history_status_failed");

  if (isLoading) {
    return (
      <div className="bg-white rounded border border-slate-200 shadow-sm p-10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t("dhis2.title")}</h2>
            <p className="text-xs text-slate-500">{t("dhis2.description")}</p>
          </div>
          <Badge variant={form.enabled ? "default" : "outline"}>
            {form.enabled ? t("dhis2.status_enabled") : t("dhis2.status_disabled")}
          </Badge>
        </div>

        <div className="h-px bg-slate-100 w-full" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
              {t("dhis2.base_url")}
            </label>
            <Input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://dhis-minsante-cm.org"
              className="text-sm h-10 bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
              {t("dhis2.username")}
            </label>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="text-sm h-10 bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
              {t("dhis2.password")}
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={hasPassword ? t("dhis2.password_unchanged") : ""}
              className="text-sm h-10 bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
              {t("dhis2.org_unit_id")}
            </label>
            <Dhis2EntityPicker
              type="orgUnits"
              currentId={form.orgUnitId}
              onSelect={(entity) => setForm({ ...form, orgUnitId: entity?.id ?? "" })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
              {t("dhis2.data_set_id")}
            </label>
            <Dhis2EntityPicker
              type="dataSets"
              currentId={form.dataSetId}
              onSelect={(entity) => setForm({ ...form, dataSetId: entity?.id ?? "" })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
          />
          {t("dhis2.enable_sync")}
        </label>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white hover:bg-slate-800 text-xs h-8">
            {isSaving ? t("dhis2.saving") : t("dhis2.save_connection")}
          </Button>
          <Button onClick={handleTestConnection} disabled={isTesting} variant="outline" className="text-xs h-8">
            {isTesting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
            {t("dhis2.test_connection")}
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-xs ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
            {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {testResult.message}
          </div>
        )}
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{t("dhis2.mapping_title")}</h3>
          <p className="text-xs text-slate-500">{t("dhis2.mapping_desc")}</p>
        </div>

        <div className="space-y-3">
          {DHIS2_METRIC_KEYS.map((metricKey) => {
            const mapping = mappingFor(form.mappings, metricKey);
            return (
              <div key={metricKey} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3 items-end border-b border-slate-100 pb-3 last:border-0">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                    {t(`dhis2.metrics.${metricKey}`)}
                  </label>
                  <p className="text-[11px] text-slate-400 font-mono">{metricKey}</p>
                </div>
                <Dhis2EntityPicker
                  type="dataElements"
                  dataSetId={form.dataSetId}
                  currentId={mapping.dataElementId}
                  onSelect={(entity) => updateMapping(metricKey, "dataElementId", entity?.id ?? "")}
                  placeholder={t("dhis2.data_element_uid")}
                />
                <Input
                  value={mapping.categoryOptionComboId ?? ""}
                  onChange={(e) => updateMapping(metricKey, "categoryOptionComboId", e.target.value)}
                  placeholder={t("dhis2.category_option_combo_uid_optional")}
                  className="text-xs h-9 font-mono bg-white"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t("dhis2.sync_title")}</h3>
            <p className="text-xs text-slate-500">{t("dhis2.sync_desc")}</p>
          </div>
          <Button onClick={() => handleSyncNow()} disabled={isSyncing || !hasPassword} className="text-xs h-8">
            {isSyncing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Send className="h-3 w-3 mr-2" />}
            {t("dhis2.sync_now")}
          </Button>
        </div>

        {syncResult && (
          <div className={`flex items-center gap-2 text-xs ${syncResult.ok ? "text-green-700" : "text-red-600"}`}>
            {syncResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {syncResult.message}
          </div>
        )}
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="text-sm font-bold text-slate-900">{t("dhis2.history_title")}</h3>
          <p className="text-xs text-slate-500">{t("dhis2.history_desc")}</p>
        </div>
        {isLoadingHistory ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                <th className="px-6 py-2">{t("dhis2.history_period")}</th>
                <th className="px-6 py-2">{t("dhis2.history_status")}</th>
                <th className="px-6 py-2 text-right">{t("dhis2.history_values")}</th>
                <th className="px-6 py-2">{t("dhis2.history_detail")}</th>
                <th className="px-6 py-2 text-right">{t("dhis2.history_action")}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">{t("dhis2.no_history")}</td>
                </tr>
              )}
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-3 font-mono text-slate-700">{entry.period}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        entry.status === "success"
                          ? "bg-green-100 text-green-700"
                          : entry.status === "skipped"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {historyStatusLabel(entry.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-mono">{entry.dataValueCount ?? "—"}</td>
                  <td className="px-6 py-3 text-slate-500 max-w-xs truncate" title={entry.error || entry.unmappedMetrics?.join(", ")}>
                    {entry.error || (entry.unmappedMetrics?.length ? `${t("dhis2.unmapped")}: ${entry.unmappedMetrics.join(", ")}` : "—")}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {(entry.status === "failed" || entry.status === "skipped") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        disabled={retryingPeriod === entry.period}
                        onClick={() => handleSyncNow(entry.period)}
                      >
                        {retryingPeriod === entry.period ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                        ) : (
                          <RotateCw className="h-3 w-3 mr-1.5" />
                        )}
                        {t("dhis2.retry")}
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
