"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setActiveModules, setTenantAccess } = useAppStore();
  const { data: session, status } = useSession();
  const [isHydrated, setIsHydrated] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [tenantIsActive, setTenantIsActive] = useState(true);
  const [tenantReason, setTenantReason] = useState<string | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  const refreshTenantAccess = async () => {
    const response = await fetch("/api/v1/licensing/status", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to check tenant status.");
    }

    const data = await response.json();
    const isActive = Boolean(data?.isActive);
    const reason = typeof data?.reason === "string" ? data.reason : null;
    const activeModules = Array.isArray(data?.activeModules) ? data.activeModules : [];

    setTenantIsActive(isActive);
    setTenantReason(reason);
    setTenantAccess(isActive, reason);
    setActiveModules(isActive ? activeModules : []);
  };

  useEffect(() => {
    const initialize = async () => {
      if (status === "authenticated" && session?.user) {
        setCheckingAccess(true);
        setUser({
          id: session.user.id,
          fullName: session.user.name || "",
          email: session.user.email || "",
          role: session.user.role,
        });
        setActiveModules(session.user.modules || []);

        if (session.user.role !== "admin") {
          try {
            await refreshTenantAccess();
          } catch (error) {
            setTenantIsActive(false);
            setTenantReason("Unable to verify tenant subscription and invoice validity.");
            setTenantAccess(false, "Unable to verify tenant subscription and invoice validity.");
            console.error("Failed to resolve tenant access:", error);
          } finally {
            setCheckingAccess(false);
          }
        } else {
          setTenantIsActive(true);
          setTenantReason(null);
          setTenantAccess(true, null);
          setCheckingAccess(false);
        }
      } else if (status === "unauthenticated") {
        setUser(null);
        setTenantIsActive(true);
        setTenantReason(null);
        setTenantAccess(true, null);
        setCheckingAccess(false);
      }

      if (status !== "loading") {
        setIsHydrated(true);
      }
    };

    void initialize();
  }, [session, status, setUser, setActiveModules, setTenantAccess]);

  const handleActivateTenant = async () => {
    if (!licenseKey.trim()) {
      setActivationError("Please enter a license key.");
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
        throw new Error(payload?.error || "Failed to activate tenant.");
      }

      setLicenseKey("");
      await refreshTenantAccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to activate tenant.";
      setActivationError(message);
    } finally {
      setActivationLoading(false);
    }
  };

  if (!isHydrated || checkingAccess) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (status === "authenticated" && session?.user?.role !== "admin" && !tenantIsActive) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Tenant Inactive</CardTitle>
            <CardDescription>
              A valid paid invoice for a monthly or yearly subscription is required to access modules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantReason ? (
              <p className="text-sm text-slate-600">{tenantReason}</p>
            ) : null}
            <div className="space-y-2">
              <label htmlFor="license-key" className="text-sm font-medium text-slate-700">
                Enter license key
              </label>
              <Input
                id="license-key"
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value.toUpperCase())}
                disabled={activationLoading}
              />
            </div>
            {activationError ? (
              <p className="text-sm text-red-600">{activationError}</p>
            ) : null}
            <Button onClick={handleActivateTenant} disabled={activationLoading} className="w-full">
              {activationLoading ? "Activating..." : "Activate Tenant"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
