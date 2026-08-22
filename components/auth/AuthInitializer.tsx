"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useAppStore, ModulePermission } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mergeModulePermissions } from "@/lib/utils";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setActiveModules, setTenantAccess } = useAppStore();
  const { data: session, status } = useSession();
  const t = useTranslations("licensing");
  const [isHydrated, setIsHydrated] = useState(false);
  const [tenantIsActive, setTenantIsActive] = useState(true);
  const [tenantReason, setTenantReason] = useState<string | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryFnRef = useRef<() => void>(() => {});

  const refreshTenantAccess = useCallback(async () => {
    const response = await fetch("/api/v1/licensing/status", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(t("failed_check_tenant_status"));
    }

    const data = await response.json();
    const isActive = Boolean(data?.isActive);
    const reason = typeof data?.reason === "string" ? data.reason : null;
    const tenantModules = Array.isArray(data?.activeModules) ? data.activeModules : [];

    return {
      isActive,
      reason,
      tenantModules,
    };
  }, [t]);

  // Applies a freshly-fetched tenant-access result to component state — shared by the
  // initial-session effect and handleActivateTenant, so a successful activation actually
  // dismisses the gate screen instead of only being reflected on the next page load.
  const applyTenantAccess = useCallback(
    (isActive: boolean, reason: string | null, tenantModules: ModulePermission[]) => {
      retryCountRef.current = 0;
      setTenantIsActive(isActive);
      setTenantReason(reason);
      setTenantAccess(isActive, reason);

      if (session?.user?.role === "tenant_admin") {
        setActiveModules(tenantModules);
      } else {
        const userModules = Array.isArray(session?.user?.modules) ? session.user.modules : [];
        const mergedModules = isActive ? mergeModulePermissions(tenantModules, userModules) : [];
        setActiveModules(mergedModules);
      }
    },
    [session, setActiveModules, setTenantAccess]
  );

  // Retries a failed tenant-access verification in the background, re-arming itself on
  // repeated failure up to 3 attempts with backoff, instead of leaving the user stuck on
  // whatever transient error triggered the first failure.
  const scheduleTenantAccessRetry = useCallback(() => {
    if (retryCountRef.current >= 3) return;
    retryCountRef.current += 1;
    const attempt = retryCountRef.current;
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = setTimeout(async () => {
      try {
        const { isActive, reason, tenantModules } = await refreshTenantAccess();
        applyTenantAccess(isActive, reason, tenantModules);
      } catch (retryError) {
        console.error("Retry to resolve tenant access failed:", retryError);
        retryFnRef.current();
      }
    }, 4000 * attempt);
  }, [refreshTenantAccess, applyTenantAccess]);

  useEffect(() => {
    retryFnRef.current = scheduleTenantAccessRetry;
  }, [scheduleTenantAccessRetry]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      if (status === "authenticated" && session?.user) {
        setUser({
          id: session.user.id,
          fullName: session.user.name || "",
          email: session.user.email || "",
          role: session.user.role,
        });
        setActiveModules(session.user.modules || []);

        if (session.user.role !== "admin") {
          try {
            const { isActive, reason, tenantModules } = await refreshTenantAccess();
            applyTenantAccess(isActive, reason, tenantModules);
          } catch (error) {
            // A network hiccup or a transient 5xx here is not proof the tenant is inactive —
            // treat it as "couldn't verify yet", not "denied". Keep whatever access the JWT
            // already grants (the server still enforces real permissions on every API call
            // regardless of this client-side gate) and retry silently in the background
            // instead of locking the user out until they happen to refresh.
            setTenantIsActive(true);
            setTenantReason(null);
            setTenantAccess(true, null);
            setActiveModules(session.user.modules || []);
            console.error("Failed to resolve tenant access, will retry:", error);
            scheduleTenantAccessRetry();
          }
        } else {
          setTenantIsActive(true);
          setTenantReason(null);
          setTenantAccess(true, null);
        }
      } else if (status === "unauthenticated") {
        setUser(null);
        setTenantIsActive(true);
        setTenantReason(null);
        setTenantAccess(true, null);
      }

      if (status !== "loading") {
        setIsHydrated(true);
      }
    };

    void initialize();
  }, [session, status, setUser, setActiveModules, setTenantAccess, refreshTenantAccess, applyTenantAccess, scheduleTenantAccessRetry]);

  const handleActivateTenant = async () => {
    if (!licenseKey.trim()) {
      setActivationError(t("please_enter_license_key"));
      return;
    }

    setActivationLoading(true);
    setActivationError(null);

    try {
      const response = await fetch("/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || t("activation_failed"));
      }

      setLicenseKey("");
      const { isActive, reason, tenantModules } = await refreshTenantAccess();
      applyTenantAccess(isActive, reason, tenantModules);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("activation_failed");
      setActivationError(message);
    } finally {
      setActivationLoading(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">{t("initializing_system")}</p>
        </div>
      </div>
    );
  }

  if (status === "authenticated" && session?.user?.role !== "admin" && !tenantIsActive) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>{t("tenant_inactive_title")}</CardTitle>
            <CardDescription>{t("tenant_inactive_description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantReason ? (
              <p className="text-sm text-slate-600">{tenantReason}</p>
            ) : null}
            <div className="space-y-2">
              <label htmlFor="license-key" className="text-sm font-medium text-slate-700">
                {t("enter_license_key_label")}
              </label>
              <Input
                id="license-key"
                placeholder={t("license_key_placeholder")}
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value.toUpperCase())}
                disabled={activationLoading}
              />
            </div>
            {activationError ? (
              <p className="text-sm text-red-600">{activationError}</p>
            ) : null}
            <Button onClick={handleActivateTenant} disabled={activationLoading} className="w-full">
              {activationLoading ? t("activating_tenant") : t("activate_tenant")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
