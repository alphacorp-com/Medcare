"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ServerCog, Loader2, Wifi, Upload, Download, AlertTriangle, ShieldAlert, Fingerprint, CheckCircle2,
} from "lucide-react";

type LicenseStatus = {
  license: {
    tier: string;
    modules: string[];
    maxUsers: number;
    maxBeds: number;
    validFrom: string;
    validUntil: string;
    gracePeriodDays: number;
    channel: string;
    appliedAt: string;
  } | null;
  guard: {
    blocked: boolean;
    reason?: "no_license" | "expired";
    validUntil?: string;
    gracePeriodEndsAt?: string;
    clockSuspicious?: boolean;
  };
  fingerprint: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRY_WARNING_DAYS = 30;

export function OnPremLicensePanel() {
  const t = useTranslations("settings");

  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isActivating, setIsActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState("");

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/onprem-license/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch on-prem license status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleActivateOnline = async () => {
    setIsActivating(true);
    setActivateError(null);
    setActivateSuccess(null);
    try {
      const res = await fetch("/api/v1/onprem-license/activate-online", { method: "POST" });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || t("onprem_activate_error"));
      }
      setActivateSuccess(t("onprem_activate_success", { date: new Date(payload.validUntil).toLocaleDateString() }));
      await fetchStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("onprem_activate_error");
      setActivateError(message);
    } finally {
      setIsActivating(false);
    }
  };

  const handleDownloadRequest = () => {
    window.location.href = "/api/v1/onprem-license/request-file";
  };

  const handleImportFile = async (file: File) => {
    setImportFileName(file.name);
    setImportError(null);
    setImportSuccess(null);
    setIsImporting(true);
    try {
      let token: string;
      try {
        token = await file.text();
      } catch {
        throw new Error(t("onprem_import_read_error"));
      }

      const res = await fetch("/api/v1/onprem-license/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || t("onprem_import_error"));
      }
      setImportSuccess(t("onprem_import_success", { date: new Date(payload.validUntil).toLocaleDateString() }));
      await fetchStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("onprem_import_error");
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const guard = status?.guard;
  const license = status?.license ?? null;

  const referenceDeadline = guard?.gracePeriodEndsAt ?? guard?.validUntil ?? license?.validUntil;
  const daysUntilDeadline = referenceDeadline
    ? Math.ceil((new Date(referenceDeadline).getTime() - Date.now()) / MS_PER_DAY)
    : null;
  const isExpiringSoon = !guard?.blocked && daysUntilDeadline !== null && daysUntilDeadline <= EXPIRY_WARNING_DAYS;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-slate-400" /> {t("onprem_license_management")}
          </h2>
          <p className="text-xs text-slate-500">{t("onprem_license_management_desc")}</p>
        </div>

        {guard?.blocked && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {guard.reason === "no_license" ? t("onprem_blocked_no_license") : t("onprem_blocked_expired")}
              </p>
              {guard.clockSuspicious && (
                <p className="text-xs text-red-700 mt-1">{t("onprem_clock_suspicious")}</p>
              )}
            </div>
          </div>
        )}

        {!guard?.blocked && isExpiringSoon && daysUntilDeadline !== null && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-amber-800">
              {t("onprem_expiring_soon", { days: Math.max(daysUntilDeadline, 0) })}
            </p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("onprem_status_title")}</h3>

          {!license ? (
            <p className="text-sm text-slate-500">{t("onprem_no_license")}</p>
          ) : (
            <div className="bg-slate-50 rounded-lg p-4 border space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t("onprem_tier")}:</span>
                  <span className="ml-2 font-medium text-slate-900">{license.tier}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t("onprem_channel")}:</span>
                  <Badge
                    variant="outline"
                    className={`ml-2 ${license.channel === "online" ? "border-blue-200 text-blue-700 bg-blue-50" : "border-slate-300 text-slate-700 bg-white"}`}
                  >
                    {license.channel === "online" ? t("onprem_channel_online") : t("onprem_channel_offline")}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500">{t("onprem_max_users")}:</span>
                  <span className="ml-2 font-medium text-slate-900">{license.maxUsers}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t("onprem_max_beds")}:</span>
                  <span className="ml-2 font-medium text-slate-900">{license.maxBeds}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t("onprem_valid_until")}:</span>
                  <span className="ml-2 font-medium text-slate-900">
                    {new Date(license.validUntil).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">{t("onprem_applied_at")}:</span>
                  <span className="ml-2 font-medium text-slate-900">
                    {new Date(license.appliedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {license.modules.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500 block mb-1.5">{t("onprem_modules")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {license.modules.map((module) => (
                      <Badge key={module} variant="secondary" className="text-[10px]">
                        {module}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {status?.fingerprint && (
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-3">
            <Fingerprint className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
            <div>
              <span className="block font-medium text-slate-600">{t("onprem_fingerprint_label")}</span>
              <span className="font-mono text-sm text-slate-800 tracking-wide">{status.fingerprint}</span>
              <span className="block text-[11px] text-slate-400 mt-0.5">{t("onprem_fingerprint_hint")}</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-slate-400" /> {t("onprem_activate_online")}
          </h3>
        </div>

        {activateError && <p className="text-sm text-red-600">{activateError}</p>}
        {activateSuccess && (
          <p className="text-sm text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {activateSuccess}
          </p>
        )}

        <Button onClick={handleActivateOnline} disabled={isActivating} className="w-full sm:w-auto">
          {isActivating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("onprem_activating")}
            </>
          ) : (
            t("onprem_activate_online")
          )}
        </Button>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{t("onprem_download_request")}</h3>
          <p className="text-xs text-slate-500 mt-1">{t("onprem_download_request_desc")}</p>
        </div>
        <Button variant="outline" onClick={handleDownloadRequest} className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" /> {t("onprem_download_request")}
        </Button>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{t("onprem_import_title")}</h3>
          <p className="text-xs text-slate-500 mt-1">{t("onprem_import_desc")}</p>
        </div>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg py-8 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
          <Upload className="h-6 w-6 text-slate-400" />
          <span className="text-xs text-slate-600">{importFileName || t("onprem_import_choose_file")}</span>
          <input
            type="file"
            className="hidden"
            disabled={isImporting}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImportFile(file);
              event.target.value = "";
            }}
          />
        </label>

        {isImporting && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("onprem_importing")}
          </p>
        )}
        {importError && <p className="text-sm text-red-600">{importError}</p>}
        {importSuccess && (
          <p className="text-sm text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {importSuccess}
          </p>
        )}
      </div>
    </div>
  );
}
