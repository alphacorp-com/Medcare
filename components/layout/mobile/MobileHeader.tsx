"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { LogOut, Menu, MessageSquare, Settings } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { MedcareLogo, PoweredByAlphaCorp } from "@/components/brand/logos";
import { NAV_ITEMS, NAV_GROUP_LABEL_KEY, isNavHrefActive, type NavGroup } from "../navigation";
import { useOrganizationInfo, useUnreadMessagesCount, type OrganizationInfo } from "../use-layout-data";

const LOCALES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
] as const;

function userInitials(fullName: string | undefined) {
  return (fullName ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function OrganizationBadge({ organization, fallbackName }: { organization: OrganizationInfo | null; fallbackName: string }) {
  if (!organization) {
    return (
      <div className="flex min-w-0 flex-1 animate-pulse items-center gap-2.5">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-2/3 rounded bg-slate-200" />
          <div className="h-2.5 w-1/2 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {organization.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant logo is a data/remote URL of unknown host
        <img src={organization.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5" />
      ) : (
        // No tenant logo configured: fall back to the MedCare mark.
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
          <MedcareLogo compact className="h-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-tight text-slate-900">{organization.name || fallbackName}</p>
        {organization.address && <p className="truncate text-[11px] text-slate-500">{organization.address}</p>}
      </div>
    </div>
  );
}

export function MobileHeader() {
  const t = useTranslations("mobileNav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, hasModule, setUser, setActiveModules } = useAppStore();
  const organization = useOrganizationInfo();
  const unreadMessages = useUnreadMessagesCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const availableItems = NAV_ITEMS.filter((item) => !item.module || hasModule(item.module));
  const ungroupedItems = availableItems.filter((item) => !item.group);
  const groups = (Object.keys(NAV_GROUP_LABEL_KEY) as NavGroup[])
    .map((group) => ({ group, items: availableItems.filter((item) => item.group === group) }))
    .filter(({ items }) => items.length > 0);

  const menuLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
    );

  const handleLocaleChange = (code: string) => {
    setAccountOpen(false);
    router.replace(pathname, { locale: code });
  };

  const handleLogout = async () => {
    setAccountOpen(false);
    setUser(null);
    setActiveModules([]);
    await signOut({ callbackUrl: `/${locale}/login` });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-white/80">
        <div className="flex h-16 items-center gap-2 px-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("open_menu")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>

          <OrganizationBadge organization={organization} fallbackName={tc("app_name")} />

          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label={t("open_profile")}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white ring-2 ring-blue-100"
            >
              {userInitials(currentUser?.fullName) || "?"}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation drawer: every module the user can access, grouped like the desktop sidebar. */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[85%] max-w-xs gap-0 p-0">
          <SheetHeader className="gap-4 border-b border-slate-100 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <SheetTitle className="sr-only">{t("open_menu")}</SheetTitle>
            <MedcareLogo className="h-7 self-start" />
            <OrganizationBadge organization={organization} fallbackName={tc("app_name")} />
          </SheetHeader>

          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {ungroupedItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={menuLinkClass(isNavHrefActive(item.href, pathname))}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {tc(item.name)}
                </Link>
              ))}
            </div>

            {groups.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{tc(NAV_GROUP_LABEL_KEY[group])}</p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={menuLinkClass(isNavHrefActive(item.href, pathname))}>
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{tc(item.name)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-1 border-t border-slate-100 pt-4">
              <Link href="/messages" onClick={() => setMenuOpen(false)} className={menuLinkClass(isNavHrefActive("/messages", pathname))}>
                <MessageSquare className="h-5 w-5 shrink-0" />
                <span className="flex-1">{tc("messages")}</span>
                {unreadMessages > 0 && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </Link>
              <Link href="/settings" onClick={() => setMenuOpen(false)} className={menuLinkClass(isNavHrefActive("/settings", pathname))}>
                <Settings className="h-5 w-5 shrink-0" />
                {tc("settings")}
              </Link>
            </div>
          </nav>

          <div className="border-t border-slate-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <PoweredByAlphaCorp label={tc("powered_by")} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Account sheet: who is signed in, language, settings and sign-out. */}
      <Sheet open={accountOpen} onOpenChange={setAccountOpen}>
        <SheetContent side="bottom" className="gap-0 rounded-t-3xl p-0 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden />
          <SheetHeader className="px-5 pb-2 pt-3">
            <SheetTitle className="text-base">{t("account")}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 px-5 pb-5">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {userInitials(currentUser?.fullName) || "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{currentUser?.fullName ?? "—"}</p>
                <p className="truncate text-xs text-slate-500">{currentUser?.email}</p>
                {currentUser?.role && (
                  <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{currentUser.role}</span>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">{t("language")}</p>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {LOCALES.map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleLocaleChange(code)}
                    className={cn(
                      "rounded-lg py-2 text-sm font-medium transition",
                      locale === code ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/settings"
                onClick={() => setAccountOpen(false)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
              >
                <Settings className="h-4 w-4" /> {t("settings")}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-semibold text-red-600"
              >
                <LogOut className="h-4 w-4" /> {t("logout")}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
