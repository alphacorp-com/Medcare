"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface OrangeFormState {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  merchantKey: string;
  country: string;
}

interface MtnFormState {
  enabled: boolean;
  subscriptionKey: string;
  apiUserId: string;
  apiKey: string;
  targetEnvironment: string;
  baseUrl: string;
}

const EMPTY_ORANGE: OrangeFormState = { enabled: false, clientId: "", clientSecret: "", merchantKey: "", country: "cm" };
const EMPTY_MTN: MtnFormState = {
  enabled: false,
  subscriptionKey: "",
  apiUserId: "",
  apiKey: "",
  targetEnvironment: "mtncameroon",
  baseUrl: "https://proxy.momoapi.mtn.com",
};

export function MobileMoneySettings() {
  const t = useTranslations("settings");

  const [orange, setOrange] = useState<OrangeFormState>(EMPTY_ORANGE);
  const [mtn, setMtn] = useState<MtnFormState>(EMPTY_MTN);
  const [hasOrangeSecret, setHasOrangeSecret] = useState(false);
  const [hasMtnKeys, setHasMtnKeys] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: "orange" | "mtn"; ok: boolean; message: string } | null>(null);
  const [testingProvider, setTestingProvider] = useState<"orange" | "mtn" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/v1/settings/payments");
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.orange) {
            setOrange({
              enabled: Boolean(data.orange.enabled),
              clientId: data.orange.clientId ?? "",
              clientSecret: "",
              merchantKey: data.orange.merchantKey ?? "",
              country: data.orange.country ?? "cm",
            });
            setHasOrangeSecret(Boolean(data.orange.hasClientSecret));
          }
          if (data.mtn) {
            setMtn({
              enabled: Boolean(data.mtn.enabled),
              subscriptionKey: "",
              apiUserId: data.mtn.apiUserId ?? "",
              apiKey: "",
              targetEnvironment: data.mtn.targetEnvironment ?? "mtncameroon",
              baseUrl: data.mtn.baseUrl ?? "https://proxy.momoapi.mtn.com",
            });
            setHasMtnKeys(Boolean(data.mtn.hasSubscriptionKey && data.mtn.hasApiKey));
          }
        }
      } catch (error) {
        console.error("Failed to fetch mobile money settings", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/v1/settings/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orange: {
            enabled: orange.enabled,
            clientId: orange.clientId,
            clientSecret: orange.clientSecret || undefined,
            merchantKey: orange.merchantKey,
            country: orange.country,
          },
          mtn: {
            enabled: mtn.enabled,
            subscriptionKey: mtn.subscriptionKey || undefined,
            apiUserId: mtn.apiUserId,
            apiKey: mtn.apiKey || undefined,
            targetEnvironment: mtn.targetEnvironment,
            baseUrl: mtn.baseUrl,
          },
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setSaveError(payload?.error || t("payments.save_error"));
        return;
      }
      setHasOrangeSecret(true);
      setHasMtnKeys(true);
      setOrange((prev) => ({ ...prev, clientSecret: "" }));
      setMtn((prev) => ({ ...prev, subscriptionKey: "", apiKey: "" }));
    } catch {
      setSaveError(t("payments.save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (provider: "orange" | "mtn") => {
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/settings/payments/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const payload = await res.json();
      setTestResult({
        provider,
        ok: Boolean(payload.ok),
        message: payload.ok ? t("payments.test_success") : payload.error || t("payments.test_failed"),
      });
    } catch {
      setTestResult({ provider, ok: false, message: t("payments.test_failed") });
    } finally {
      setTestingProvider(null);
    }
  };

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
            <h2 className="text-lg font-bold text-slate-900">{t("payments.orange_title")}</h2>
            <p className="text-xs text-slate-500">{t("payments.orange_description")}</p>
          </div>
          <Badge variant={orange.enabled ? "default" : "outline"}>
            {orange.enabled ? t("payments.status_enabled") : t("payments.status_disabled")}
          </Badge>
        </div>

        <div className="h-px bg-slate-100 w-full" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.client_id")}</label>
            <Input value={orange.clientId} onChange={(e) => setOrange({ ...orange, clientId: e.target.value })} className="text-sm h-10 bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.client_secret")}</label>
            <Input
              type="password"
              value={orange.clientSecret}
              onChange={(e) => setOrange({ ...orange, clientSecret: e.target.value })}
              placeholder={hasOrangeSecret ? t("payments.secret_unchanged") : ""}
              className="text-sm h-10 bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.merchant_key")}</label>
            <Input value={orange.merchantKey} onChange={(e) => setOrange({ ...orange, merchantKey: e.target.value })} className="text-sm h-10 font-mono bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.country")}</label>
            <Input value={orange.country} onChange={(e) => setOrange({ ...orange, country: e.target.value })} className="text-sm h-10 bg-white" placeholder="cm" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
          <input type="checkbox" checked={orange.enabled} onChange={(e) => setOrange({ ...orange, enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
          {t("payments.enable_provider")}
        </label>

        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => handleTest("orange")} disabled={testingProvider === "orange"} variant="outline" className="text-xs h-8">
            {testingProvider === "orange" ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
            {t("payments.test_connection")}
          </Button>
        </div>
        {testResult?.provider === "orange" && (
          <div className={`flex items-center gap-2 text-xs ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
            {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {testResult.message}
          </div>
        )}
        <p className="text-[11px] text-slate-400">{t("payments.orange_note")}</p>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t("payments.mtn_title")}</h2>
            <p className="text-xs text-slate-500">{t("payments.mtn_description")}</p>
          </div>
          <Badge variant={mtn.enabled ? "default" : "outline"}>
            {mtn.enabled ? t("payments.status_enabled") : t("payments.status_disabled")}
          </Badge>
        </div>

        <div className="h-px bg-slate-100 w-full" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.subscription_key")}</label>
            <Input
              type="password"
              value={mtn.subscriptionKey}
              onChange={(e) => setMtn({ ...mtn, subscriptionKey: e.target.value })}
              placeholder={hasMtnKeys ? t("payments.secret_unchanged") : ""}
              className="text-sm h-10 bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.api_user_id")}</label>
            <Input value={mtn.apiUserId} onChange={(e) => setMtn({ ...mtn, apiUserId: e.target.value })} className="text-sm h-10 font-mono bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.api_key")}</label>
            <Input
              type="password"
              value={mtn.apiKey}
              onChange={(e) => setMtn({ ...mtn, apiKey: e.target.value })}
              placeholder={hasMtnKeys ? t("payments.secret_unchanged") : ""}
              className="text-sm h-10 bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.target_environment")}</label>
            <Input value={mtn.targetEnvironment} onChange={(e) => setMtn({ ...mtn, targetEnvironment: e.target.value })} className="text-sm h-10 bg-white" />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">{t("payments.base_url")}</label>
            <Input value={mtn.baseUrl} onChange={(e) => setMtn({ ...mtn, baseUrl: e.target.value })} className="text-sm h-10 bg-white" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
          <input type="checkbox" checked={mtn.enabled} onChange={(e) => setMtn({ ...mtn, enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
          {t("payments.enable_provider")}
        </label>

        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => handleTest("mtn")} disabled={testingProvider === "mtn"} variant="outline" className="text-xs h-8">
            {testingProvider === "mtn" ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
            {t("payments.test_connection")}
          </Button>
        </div>
        {testResult?.provider === "mtn" && (
          <div className={`flex items-center gap-2 text-xs ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
            {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {testResult.message}
          </div>
        )}
        <p className="text-[11px] text-slate-400">{t("payments.mtn_note")}</p>
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white hover:bg-slate-800 text-xs h-8">
        {isSaving ? t("payments.saving") : t("payments.save_settings")}
      </Button>
    </div>
  );
}
