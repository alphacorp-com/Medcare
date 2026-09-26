"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, MessageSquare, Settings, type LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NAV_ITEMS, isNavHrefActive, type NavItem } from "../navigation";
import { useUnreadMessagesCount } from "../use-layout-data";
import { PoweredByAlphaCorp } from "@/components/brand/logos";

// Modules offered as direct tabs, in priority order; the first two the user can access are
// shown, the rest live in the "More" sheet.
const TAB_CANDIDATES = ["patients", "stays", "consultations", "pharmacy", "laboratory"];
const MODULE_TAB_COUNT = 2;
// Tab labels must stay short; these override the longer sidebar labels.
const SHORT_LABEL_KEYS: Record<string, string> = { dashboard: "home", patients: "patients", stays: "stays" };

function TabIcon({ icon: Icon, active, badge }: { icon: LucideIcon; active: boolean; badge?: number }) {
  return (
    <span
      className={cn(
        "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
        active ? "bg-blue-100 text-blue-700" : "text-slate-500"
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </span>
  );
}

const tabClass = "flex min-w-0 flex-col items-center justify-center gap-0.5";
const tabLabelClass = (active: boolean) =>
  cn("max-w-full truncate px-1 text-[11px]", active ? "font-semibold text-blue-700" : "font-medium text-slate-500");

export function MobileBottomNav() {
  const t = useTranslations("mobileNav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const hasModule = useAppStore((state) => state.hasModule);
  const unreadMessages = useUnreadMessagesCount();
  const [moreOpen, setMoreOpen] = useState(false);

  const availableItems = NAV_ITEMS.filter((item) => !item.module || hasModule(item.module));
  const home = availableItems.find((item) => item.href === "/");
  const moduleTabs = TAB_CANDIDATES
    .map((name) => availableItems.find((item) => item.name === name))
    .filter((item): item is NavItem => Boolean(item))
    .slice(0, MODULE_TAB_COUNT);
  const tabs = [home, ...moduleTabs].filter((item): item is NavItem => Boolean(item));
  const moreItems = availableItems.filter((item) => !tabs.includes(item));

  const label = (item: NavItem) => (SHORT_LABEL_KEYS[item.name] ? t(SHORT_LABEL_KEYS[item.name]) : tc(item.name));
  const messagesActive = isNavHrefActive("/messages", pathname);
  const settingsActive = isNavHrefActive("/settings", pathname);
  // "More" is highlighted whenever the current page is one of the services it contains.
  const moreActive = settingsActive || moreItems.some((item) => isNavHrefActive(item.href, pathname));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-white/85">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabs.length + 2}, minmax(0, 1fr))` }}>
          {tabs.map((item) => {
            const active = isNavHrefActive(item.href, pathname);
            return (
              <Link key={item.href} href={item.href} className={tabClass} aria-current={active ? "page" : undefined}>
                <TabIcon icon={item.icon} active={active} />
                <span className={tabLabelClass(active)}>{label(item)}</span>
              </Link>
            );
          })}

          <Link href="/messages" className={tabClass} aria-current={messagesActive ? "page" : undefined}>
            <TabIcon icon={MessageSquare} active={messagesActive} badge={unreadMessages} />
            <span className={tabLabelClass(messagesActive)}>{t("messages")}</span>
          </Link>

          <button type="button" onClick={() => setMoreOpen(true)} className={tabClass}>
            <TabIcon icon={LayoutGrid} active={moreActive} />
            <span className={tabLabelClass(moreActive)}>{t("more")}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-3xl p-0 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden />
          <SheetHeader className="px-5 pb-2 pt-3">
            <SheetTitle className="text-base">{t("more_title")}</SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-3 gap-2 overflow-y-auto px-4 pb-5">
            {[...moreItems, { name: "settings", href: "/settings", icon: Settings, module: null } as NavItem].map((item) => {
              const active = isNavHrefActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors",
                    active ? "bg-blue-50" : "hover:bg-slate-50 active:bg-slate-100"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl",
                      active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                  </span>
                  <span className={cn("line-clamp-2 text-xs leading-tight", active ? "font-semibold text-blue-700" : "text-slate-700")}>
                    {tc(item.name)}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex justify-center border-t border-slate-100 px-4 py-3">
            <PoweredByAlphaCorp label={tc("powered_by")} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
