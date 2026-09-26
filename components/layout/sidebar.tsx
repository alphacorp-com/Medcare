"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/useAppStore";
import { Settings, MessageSquare } from "lucide-react";
import { NAV_ITEMS, NAV_GROUP_LABEL_KEY, isNavHrefActive, type NavGroup, type NavItem } from "./navigation";
import { useUnreadMessagesCount } from "./use-layout-data";
import { MedcareLogo, PoweredByAlphaCorp } from "@/components/brand/logos";

export function Sidebar() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const hasModule = useAppStore((state) => state.hasModule);
  const [collapsed, setCollapsed] = useState(false);
  const messagesUnreadCount = useUnreadMessagesCount();

  const navigationWithHeaders = NAV_ITEMS.reduce<{ item: NavItem; showHeader: boolean }[]>((acc, item) => {
    const previousGroup = acc[acc.length - 1]?.item.group;
    acc.push({ item, showHeader: Boolean(item.group && item.group !== previousGroup) });
    return acc;
  }, []);

  return (
    <aside className={cn(
      "bg-slate-900 flex flex-col border-r border-slate-700 shrink-0 transition-all duration-200",
      collapsed ? "w-20" : "w-60"
    )}>
      <div className="p-4 border-b border-slate-700">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-10 items-center min-w-0 w-full hover:bg-slate-800 rounded px-1",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <MedcareLogo tone="dark" compact={collapsed} />
        </button>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navigationWithHeaders.map(({ item, showHeader }) => {
          const isEnabled = !item.module || hasModule(item.module);
          const isActive = isNavHrefActive(item.href, pathname);

          return (
            <div key={item.name}>
              {showHeader && !collapsed && (
                <div className="px-4 mt-6 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold first:mt-0">
                  {t(NAV_GROUP_LABEL_KEY[item.group as NavGroup])}
                </div>
              )}

              {!isEnabled ? (
                <div
                  className={cn(
                    "flex items-center justify-between text-slate-400 opacity-50 cursor-not-allowed",
                    collapsed ? "px-3 py-3 justify-center" : "px-4 py-2"
                  )}
                >
                  <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate")}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="text-sm italic truncate">{t(item.name)}</span>}
                  </div>
                  {!collapsed && (
                    <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-500 text-[9px] rounded uppercase">{t('disabled')}</span>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href}
                  title={collapsed ? t(item.name) : undefined}
                  className={cn(
                    "flex items-center",
                    collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2",
                    isActive
                      ? "bg-slate-800 text-white border-l-4 border-blue-500 pl-3"
                      : "text-slate-400 hover:text-white hover:bg-slate-800 border-l-4 border-transparent pl-3"
                  )}
                >
                  <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate")}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="text-sm truncate">{t(item.name)}</span>}
                  </div>
                  {!collapsed && !item.hideBadge && (
                    <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
                  )}
                </Link>
              )}
            </div>
          );
        })}

        {!collapsed && (
          <div className="px-4 mt-6 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('communication')}</div>
        )}
        <Link
          href="/messages"
          title={collapsed ? t('messages') : undefined}
          className={cn(
            "flex items-center",
            collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2",
            pathname.startsWith('/messages') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent",
            "border-l-4 pl-3"
          )}
        >
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate")}>
            <div className="relative">
              <MessageSquare className="h-4 w-4 shrink-0" />
              {collapsed && messagesUnreadCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
                  {messagesUnreadCount > 99 ? "99+" : messagesUnreadCount}
                </span>
              )}
            </div>
            {!collapsed && <span className="text-sm truncate">{t('messages')}</span>}
          </div>
          {!collapsed && messagesUnreadCount > 0 && (
            <span className="shrink-0 ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-300">
              {messagesUnreadCount > 99 ? "99+" : messagesUnreadCount}
            </span>
          )}
        </Link>

        <div className={cn("border-t border-slate-800 my-3", collapsed ? "mx-3" : "mx-4")} />

        <Link
          href="/settings"
          title={collapsed ? t('settings') : undefined}
          className={cn(
            "flex items-center",
            collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2",
            pathname.startsWith('/settings') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent",
            "border-l-4 pl-3"
          )}
        >
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate")}>
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-sm truncate">{t('settings')}</span>}
          </div>
        </Link>
      </nav>
      <div className={cn("bg-slate-950 shrink-0", collapsed ? "px-2 py-3" : "px-4 py-3")}>
        <PoweredByAlphaCorp tone="dark" compact={collapsed} label={t('powered_by')} />
      </div>
    </aside>
  );
}
