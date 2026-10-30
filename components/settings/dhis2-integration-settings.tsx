"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, RotateCw } from "lucide-react";
import { useConfirm } from "@/components/providers/confirm-provider";
import { Dhis2EntityPicker } from "./dhis2-entity-picker";
import { Dhis2Rma3Panel } from "./dhis2-rma3-panel";

interface Dhis2FormState {
  baseUrl: string;
  username: string;
  password: string;
  orgUnitId: string;
  dataSetId: string;
  enabled: boolean;
}

// Shape returned by GET /api/v1/settings/dhis2/history.
interface Dhis2HistoryEntry {
  id: string;
  createdAt: string;
  period: string;
  trigger: "auto" | "manual";
  dryRun: boolean;
  status: "success" | "skipped" | "failed";
  values: number | null;
  error: string | null;
  legacy: boolean;
}

const EMPTY_FORM: Dhis2FormState = {
  baseUrl: "",
  username: "",
  password: "",
  orgUnitId: "",
  dataSetId: "",
  enabled: false,
};

export function Dhis2IntegrationSettings() {
  const t = useTranslations("settings");
  const confirm = useConfirm();

  const [form, setForm] = useState<Dhis2FormState>(EMPTY_FORM);
  const [hasPassword, setHasPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [retryingPeriod, setRetryingPeriod] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [retryResult, setRetryResult] = useState<{ ok: boolean; message: string } | null>(null);
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

  const fetchHistory = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    (async () => {
      await fetchHistory();
    })();
  }, [fetchHistory]);

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

  // Server error codes are translated; DHIS2's own messages are shown as they are.
  const errorText = (code: string | null | undefined) =>
    !code ? t("dhis2.rma3.push_failed") : t.has(`dhis2.rma3.errors.${code}`) ? t(`dhis2.rma3.errors.${code}`) : code;

  // Sends a failed month again through the API (same route and checks as the RMA3 panel).
  const handleRetry = async (period: string) => {
    if (!(await confirm({ message: t("dhis2.rma3.push_confirm", { period }), description: t("dhis2.rma3.push_confirm_desc") }))) return;
    setRetryingPeriod(period);
    setRetryResult(null);
    try {
      const res = await fetch("/api/v1/settings/dhis2/rma3/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, dryRun: false }),
      });
      const data = await res.json().catch(() => null);
      setRetryResult(
        res.ok && data?.ok
          ? { ok: true, message: t("dhis2.rma3.push_ok", { imported: data.importCount?.imported ?? 0, updated: data.importCount?.updated ?? 0, ignored: data.importCount?.ignored ?? 0 }) }
          : { ok: false, message: errorText(data?.error) }
      );
      await fetchHistory();
    } catch {
      setRetryResult({ ok: false, message: t("dhis2.rma3.push_failed") });
    } finally {
      setRetryingPeriod(null);
    }
  };

  const statusClass = (status: Dhis2HistoryEntry["status"]) =>
    status === "success" ? "bg-green-100 text-green-700" : status === "skipped" ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-700";

  const retryButton = (entry: Dhis2HistoryEntry) =>
    entry.status === "failed" && !entry.dryRun && !entry.legacy && hasPassword ? (
      <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={retryingPeriod === entry.period} onClick={() => handleRetry(entry.period)}>
        {retryingPeriod === entry.period ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <RotateCw className="h-3 w-3 mr-1.5" />}
        {t("dhis2.retry")}
      </Button>
    ) : null;

  const modeLabel = (entry: Dhis2HistoryEntry) =>
    entry.legacy ? t("dhis2.mode_legacy") : entry.dryRun ? t("dhis2.mode_dry_run") : entry.trigger === "auto" ? t("dhis2.mode_auto") : t("dhis2.mode_manual");

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
      <div className="bg-white rounded-2xl md:rounded border border-slate-200 shadow-sm p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t("dhis2.title")}</h2>
            <p className="text-xs text-slate-500">{t("dhis2.description")}</p>
          </div>
          <Badge variant={form.enabled ? "default" : "outline"}>
            {form.enabled ? t("dhis2.status_enabled") : t("dhis2.status_disabled")}
          </Badge>
        </div>

        <div className="h-px bg-slate-100 w-full" />

        <div className="grid grid-cols-1 @xl:grid-cols-2 gap-5">
          <div className="@xl:col-span-2">
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

      <Dhis2Rma3Panel hasPassword={hasPassword} onSent={fetchHistory} />

      <div className="bg-white rounded-2xl md:rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 pb-4 md:pb-4">
          <h3 className="text-sm font-bold text-slate-900">{t("dhis2.history_title")}</h3>
          <p className="text-xs text-slate-500">{t("dhis2.history_desc")}</p>
          {retryResult && (
            <div className={`mt-2 flex items-center gap-2 text-xs ${retryResult.ok ? "text-green-700" : "text-red-600"}`}>
              {retryResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {retryResult.message}
            </div>
          )}
        </div>
        {isLoadingHistory ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
          {/* Narrow content area (phone, settings beside the menu): one card per send. */}
          <ul className="divide-y divide-slate-100 border-t border-slate-100 @2xl:hidden">
            {history.length === 0 && <li className="px-4 py-8 text-center text-xs italic text-slate-400">{t("dhis2.no_history")}</li>}
            {history.map((entry) => (
              <li key={entry.id} className="space-y-1.5 px-4 py-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-slate-800">{entry.period}</span>
                    <span className="ml-2 text-slate-500">{modeLabel(entry)}</span>
                    <span className="block text-[10px] text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(entry.status)}`}>{historyStatusLabel(entry.status)}</span>
                </div>
                <div className="text-slate-600">
                  {t("dhis2.history_values")} : <span className="font-mono">{entry.values ?? "—"}</span>
                </div>
                {entry.error && <p className="break-words text-red-600">{errorText(entry.error)}</p>}
                {retryButton(entry)}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto @2xl:block">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-6 py-2">{t("dhis2.history_period")}</th>
                  <th className="px-6 py-2">{t("dhis2.history_mode")}</th>
                  <th className="px-6 py-2">{t("dhis2.history_status")}</th>
                  <th className="px-6 py-2 text-right">{t("dhis2.history_values")}</th>
                  <th className="px-6 py-2">{t("dhis2.history_detail")}</th>
                  <th className="px-6 py-2 text-right">{t("dhis2.history_action")}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">{t("dhis2.no_history")}</td>
                  </tr>
                )}
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-3 font-mono text-slate-700">
                      {entry.period}
                      <span className="block text-[10px] text-slate-400 font-sans">{new Date(entry.createdAt).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{modeLabel(entry)}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${statusClass(entry.status)}`}>
                        {historyStatusLabel(entry.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono">{entry.values ?? "—"}</td>
                    <td className="px-6 py-3 text-slate-500 max-w-xs truncate" title={entry.error ? errorText(entry.error) : undefined}>
                      {entry.error ? errorText(entry.error) : "—"}
                    </td>
                    <td className="px-6 py-3 text-right">{retryButton(entry)}                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
