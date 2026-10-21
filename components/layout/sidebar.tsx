"use client";

import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/useAppStore";
import { Settings, MessageSquare, ChevronDown } from "lucide-react";
import { NAV_ITEMS, NAV_GROUP_LABEL_KEY, isNavChildActive, isNavItemActive, type NavChild, type NavGroup, type NavItem } from "./navigation";
import { useUnreadMessagesCount } from "./use-layout-data";
import { MedcareLogo, PoweredByAlphaCorp } from "@/components/brand/logos";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

export function Sidebar() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const hasModule = useAppStore((state) => state.hasModule);
  const hasPermission = useAppStore((state) => state.hasPermission);
  const [collapsed, setCollapsed] = useState(false);
  // Parents opened / closed by hand; otherwise a parent is open while one of its pages is.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const messagesUnreadCount = useUnreadMessagesCount();
  const visibleChildren = (item: NavItem): NavChild[] =>
    (item.children ?? []).filter((c) => !c.permission || hasPermission(c.permission.module, c.permission.action));

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
      <TooltipProvider>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navigationWithHeaders.map(({ item, showHeader }) => {
          const isEnabled = !item.module || hasModule(item.module);
          const isActive = isNavItemActive(item, pathname);
          const children = visibleChildren(item);
          const isOpen = !collapsed && children.length > 0 && (toggled[item.name] ?? isActive);

          return (
            <div key={item.name}>
              {showHeader && !collapsed && (
                <div className="px-4 mt-6 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold first:mt-0">
                  {t(NAV_GROUP_LABEL_KEY[item.group as NavGroup])}
                </div>
              )}

              {!isEnabled ? (
                <Tooltip label={`${t(item.name)} — ${t('disabled')}`}>
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
                </Tooltip>
              ) : children.length > 0 && !collapsed ? (
                <>
                  <Tooltip label={t(item.name)}>
                  <button
                    type="button"
                    onClick={() => setToggled((prev) => ({ ...prev, [item.name]: !isOpen }))}
                    aria-expanded={isOpen}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2 border-l-4 pl-3",
                      isActive ? "text-white border-blue-500 bg-slate-800/60" : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent"
                    )}
                  >
                    <span className="flex items-center gap-3 truncate">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm truncate">{t(item.name)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!item.hideBadge && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
                      )}
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "rotate-180" : "")} />
                    </span>
                  </button>
                  </Tooltip>
                  {isOpen && (
                    // The ?tab= read needs a Suspense boundary; the fallback renders the same
                    // list without the tab (never an empty sidebar).
                    <Suspense fallback={<SubItems items={children} pathname={pathname} currentTab={null} />}>
                      <SubItemsFromUrl items={children} pathname={pathname} />
                    </Suspense>
                  )}
                </>
              ) : children.length > 0 ? (
                <CollapsedFlyout item={item} items={children} active={isActive} pathname={pathname} />
              ) : (
                <Tooltip label={t(item.name)}>
                <Link
                  href={item.href}
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
                </Tooltip>
              )}
            </div>
          );
        })}

        {!collapsed && (
          <div className="px-4 mt-6 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('communication')}</div>
        )}
        <Tooltip label={t('messages')}>
        <Link
          href="/messages"
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
        </Tooltip>

        <div className={cn("border-t border-slate-800 my-3", collapsed ? "mx-3" : "mx-4")} />

        <Tooltip label={t('settings')}>
        <Link
          href="/settings"
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
        </Tooltip>
      </nav>
      </TooltipProvider>
      <div className={cn("bg-slate-950 shrink-0", collapsed ? "px-2 py-3" : "px-4 py-3")}>
        <PoweredByAlphaCorp tone="dark" compact={collapsed} label={t('powered_by')} />
      </div>
    </aside>
  );
}

function SubItemsFromUrl({ items, pathname }: { items: NavChild[]; pathname: string }) {
  return <SubItems items={items} pathname={pathname} currentTab={useSearchParams().get("tab")} />;
}

function SubItems({ items, pathname, currentTab }: { items: NavChild[]; pathname: string; currentTab: string | null }) {
  const t = useTranslations("common");
  return (
    <ul className="mb-1">
      {items.map((child) => {
        const active = isNavChildActive(child, items, pathname, currentTab);
        return (
          <li key={child.href}>
            <Tooltip label={t(child.name)}>
            <Link
              href={child.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block py-1.5 pl-11 pr-4 text-[13px] truncate",
                active ? "text-white font-semibold" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <span className={cn("mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle", active ? "bg-blue-400" : "bg-slate-600")} />
              {t(child.name)}
            </Link>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

// Collapsed sidebar: a parent's sub-items open in a menu beside its icon, on hover or on
// click (keyboard included), so they stay reachable without expanding the sidebar.
function CollapsedFlyout({ item, items, active, pathname }: { item: NavItem; items: NavChild[]; active: boolean; pathname: string }) {
  const t = useTranslations("common");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        openOnHover
        delay={80}
        closeDelay={200}
        aria-label={t(item.name)}
        className={cn(
          "flex w-full items-center justify-center px-3 py-3 border-l-4 pl-3 outline-none focus-visible:bg-slate-800",
          active ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={6} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wider">{t(item.name)}</DropdownMenuLabel>
          <Suspense fallback={<FlyoutItems items={items} pathname={pathname} currentTab={null} />}>
            <FlyoutItemsFromUrl items={items} pathname={pathname} />
          </Suspense>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FlyoutItemsFromUrl({ items, pathname }: { items: NavChild[]; pathname: string }) {
  return <FlyoutItems items={items} pathname={pathname} currentTab={useSearchParams().get("tab")} />;
}

function FlyoutItems({ items, pathname, currentTab }: { items: NavChild[]; pathname: string; currentTab: string | null }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <>
      {items.map((child) => {
        const active = isNavChildActive(child, items, pathname, currentTab);
        return (
          <DropdownMenuItem
            key={child.href}
            onClick={() => router.push(child.href)}
            className={cn("cursor-pointer text-sm", active && "bg-blue-50 font-semibold text-blue-700")}
          >
            {t(child.name)}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
