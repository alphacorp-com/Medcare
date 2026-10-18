"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useAppStore, ModulePermission } from "@/lib/store/useAppStore";
import { mergeModulePermissions } from "@/lib/utils";

// Note: this only hydrates session/store state (user, module permissions,
// tenantAccess flag) — it does NOT block rendering when the license is
// inactive. That enforcement lives solely in the (guarded) route group's
// server-side layout (app/[locale]/(dashboard)/(guarded)/layout.tsx), which
// redirects to Settings > License so the admin can always reach the
// activation UI there. A second blocking screen here previously duplicated
// that gate and — unlike the guarded layout — had no exception for Settings,
// which made an inactive license lock the admin out of the one page that
// fixes it.

// What client-side access depends on. Serialized into a string key so the effect below
// re-runs only when one of these actually changes.
type AccessIdentity = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isSystemAdmin: boolean;
  modules: ModulePermission[];
};

const RETRY_DELAYS_MS = [4000, 8000, 12000];

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setActiveModules, setTenantAccess } = useAppStore();
  const { data: session, status } = useSession();
  const t = useTranslations("licensing");
  const [isHydrated, setIsHydrated] = useState(false);

  // next-auth refetches the session every time the tab becomes visible again
  // (refetchOnWindowFocus) and hands back a new `session` object even when nothing in it
  // changed. Keying the effect on the object made every refocus reset the store to the raw
  // JWT modules — empty for an administrator, whose access comes from isSystemAdmin plus
  // the license — so pages showed "restricted access" until /licensing/status answered,
  // and for good if that call failed. Keying on the content instead means a refocus with
  // the same user and permissions changes nothing.
  const accessKey =
    status === "authenticated" && session?.user
      ? JSON.stringify({
          id: session.user.id,
          fullName: session.user.name || "",
          email: session.user.email || "",
          role: session.user.role,
          isSystemAdmin: session.user.isSystemAdmin,
          modules: session.user.modules ?? [],
        } satisfies AccessIdentity)
      : status;

  useEffect(() => {
    if (accessKey === "loading") return;

    if (accessKey === "unauthenticated") {
      setUser(null);
      setTenantAccess(true, null);
      return;
    }

    const identity = JSON.parse(accessKey) as AccessIdentity;
    // Set when the user/permissions change again or the component unmounts: a response
    // that arrives afterwards belongs to a previous identity and must not be applied.
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    setUser({
      id: identity.id,
      fullName: identity.fullName,
      email: identity.email,
      role: identity.role,
      isSystemAdmin: identity.isSystemAdmin,
    });

    const fetchTenantAccess = async () => {
      const response = await fetch("/api/v1/licensing/status", { cache: "no-store" });
      if (!response.ok) throw new Error(t("failed_check_tenant_status"));
      const data = await response.json();
      return {
        isActive: Boolean(data?.isActive),
        reason: typeof data?.reason === "string" ? data.reason : null,
        tenantModules: (Array.isArray(data?.activeModules) ? data.activeModules : []) as ModulePermission[],
      };
    };

    const applyTenantAccess = (isActive: boolean, reason: string | null, tenantModules: ModulePermission[]) => {
      setTenantAccess(isActive, reason);
      if (identity.isSystemAdmin) {
        setActiveModules(tenantModules);
      } else {
        setActiveModules(isActive ? mergeModulePermissions(tenantModules, identity.modules) : []);
      }
    };

    // A network hiccup or a transient 5xx is not proof the tenant is inactive — treat it
    // as "couldn't verify yet", not "denied": keep what the JWT grants (the server still
    // enforces real permissions on every API call) and retry in the background with backoff.
    const resolve = async (attempt: number) => {
      try {
        const { isActive, reason, tenantModules } = await fetchTenantAccess();
        if (cancelled) return;
        applyTenantAccess(isActive, reason, tenantModules);
      } catch (error) {
        if (cancelled) return;
        if (attempt === 0) {
          setTenantAccess(true, null);
          setActiveModules(identity.modules);
        }
        console.error(`Failed to resolve tenant access (attempt ${attempt + 1}):`, error);
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay !== undefined) retryTimeout = setTimeout(() => void resolve(attempt + 1), delay);
      } finally {
        if (!cancelled && attempt === 0) setIsHydrated(true);
      }
    };

    void resolve(0);

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [accessKey, setUser, setActiveModules, setTenantAccess, t]);

  // Signed out there's nothing to resolve; signed in, wait for the first license check.
  if (!isHydrated && status !== "unauthenticated") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">{t("initializing_system")}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
