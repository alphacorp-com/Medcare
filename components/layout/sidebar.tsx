"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/useAppStore";
import {
  LayoutDashboard,
  Users,
  Bed,
  Pill,
  Fingerprint,
  Syringe,
  Settings,
  Activity,
  HeartPulse,
  CreditCard,
  CalendarDays,
  MessageSquare,
  ShieldPlus,
  Stethoscope
} from "lucide-react";

const navigation = [
  { name: "dashboard", href: "/", icon: LayoutDashboard, module: null, hideBadge: true },
  { name: "patients", href: "/patients", icon: Users, module: "MODULE_CORE_PATIENT" },
  { name: "stays", href: "/stays", icon: Bed, module: "MODULE_ADMISSION" },
  { name: "consultations", href: "/consultations", icon: Stethoscope, module: "MODULE_ADMISSION" },
  { name: "pharmacy", href: "/pharmacy", icon: Pill, module: "MODULE_PHARMACY" },
  { name: "laboratory", href: "/laboratory", icon: Fingerprint, module: "MODULE_LAB" },
  { name: "surgery", href: "/surgery", icon: Syringe, module: "MODULE_SURGERY" },
  { name: "radiology", href: "/radiology", icon: Activity, module: "MODULE_RADIOLOGY" },
];

export function Sidebar() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const hasModule = useAppStore((state) => state.hasModule);
  const [collapsed, setCollapsed] = useState(false);
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadMessagesCount = async () => {
      try {
        const response = await fetch('/api/v1/conversations');
        if (!response.ok) return;

        const conversations = await response.json() as Array<{ unreadCount?: number }>;
        const totalUnread = conversations.reduce((sum, conversation) => sum + (conversation.unreadCount ?? 0), 0);
        setMessagesUnreadCount(totalUnread);
      } catch {
        setMessagesUnreadCount(0);
      }
    };

    fetchUnreadMessagesCount();
    const interval = window.setInterval(fetchUnreadMessagesCount, 15000);

    return () => window.clearInterval(interval);
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
          className="flex items-center gap-3 min-w-0 w-full text-left hover:bg-slate-800 rounded px-1 py-1"
        >
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-white rounded-full"></div>
          </div>
          {!collapsed && (
            <span className="text-white font-bold tracking-tight text-lg truncate">
              {t('app_name')}
            </span>
          )}
        </button>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {!collapsed && (
          <div className="px-4 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('clinical_modules')}</div>
        )}
        {navigation.map((item) => {
          const isEnabled = !item.module || hasModule(item.module);
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          if (!isEnabled) {
            return (
              <div
                key={item.name}
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
            );
          }

          return (
            <Link
              key={item.name}
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
          );
        })}
        {!collapsed && (
          <div className="px-4 mt-6 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('administrative')}</div>
        )}

        {hasModule('MODULE_BILLING') ? (
          <Link
            href="/billing"
            title={collapsed ? t('billing') : undefined}
            className={cn(
              "flex items-center",
              collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2",
              pathname.startsWith('/billing') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent",
              "border-l-4 pl-3"
            )}
          >
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate")}>
              <CreditCard className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm truncate">{t('billing')}</span>}
            </div>
            {!collapsed && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
            )}
          </Link>
        ) : (
          <div className={cn("flex items-center text-slate-400 opacity-50 cursor-not-allowed", collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2")}>
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate pl-3")}>
              <CreditCard className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm italic truncate">{t('billing')}</span>}
            </div>
            {!collapsed && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-500 text-[9px] rounded uppercase">{t('disabled')}</span>
            )}
          </div>
        )}

        {hasModule('MODULE_PLANNING') ? (
          <Link
            href="/planning"
            title={collapsed ? t('planning') : undefined}
            className={cn(
              "flex items-center",
              collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2",
              pathname.startsWith('/planning') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent",
              "border-l-4 pl-3"
            )}
          >
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate")}>
              <CalendarDays className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm truncate">{t('planning')}</span>}
            </div>
            {!collapsed && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
            )}
          </Link>
        ) : (
          <div className={cn("flex items-center text-slate-400 opacity-50 cursor-not-allowed", collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2")}>
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate pl-3")}>
              <CalendarDays className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm italic truncate">{t('planning')}</span>}
            </div>
            {!collapsed && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-500 text-[9px] rounded uppercase">{t('disabled')}</span>
            )}
          </div>
        )}

        {hasModule('MODULE_MATERNITY') ? (
          <Link
            href="/maternity"
            title={collapsed ? t('maternity') : undefined}
            className={cn(
              "flex items-center",
              collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2",
              pathname.startsWith('/maternity') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent",
              "border-l-4 pl-3"
            )}
          >
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate")}>
              <HeartPulse className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm truncate">{t('maternity')}</span>}
            </div>
            {!collapsed && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
            )}
          </Link>
        ) : (
          <div className={cn("flex items-center text-slate-400 opacity-50 cursor-not-allowed", collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2")}>
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate pl-3")}>
              <HeartPulse className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm italic truncate">{t('maternity')}</span>}
            </div>
            {!collapsed && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-500 text-[9px] rounded uppercase">{t('disabled')}</span>
            )}
          </div>
        )}

        {hasModule('MODULE_DISEASE_PROGRAMS') ? (
          <Link
            href="/disease-programs"
            title={collapsed ? t('disease_programs') : undefined}
            className={cn(
              "flex items-center",
              collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2",
              pathname.startsWith('/disease-programs') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent",
              "border-l-4 pl-3"
            )}
          >
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate")}>
              <ShieldPlus className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm truncate">{t('disease_programs')}</span>}
            </div>
            {!collapsed && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
            )}
          </Link>
        ) : (
          <div className={cn("flex items-center text-slate-400 opacity-50 cursor-not-allowed", collapsed ? "justify-center px-3 py-3" : "justify-between px-4 py-2")}>
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 truncate pl-3")}>
              <ShieldPlus className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm italic truncate">{t('disease_programs')}</span>}
            </div>
            {!collapsed && (
              <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-500 text-[9px] rounded uppercase">{t('disabled')}</span>
            )}
          </div>
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
      <div className={cn("bg-slate-950 shrink-0", collapsed ? "p-2" : "p-4")}>
        <div className={cn("text-[10px] text-slate-500", collapsed && "text-center")}>
          {!collapsed && t('powered_by')}
          <a href="https://alphacorp.vercel.app" target="_blank" rel="noopener noreferrer">
            <p className='font-bold text-lg bg-clip-text text-transparent bg-gradient-to-l from-blue-700 to-fuchsia-400 animate-gradient'>
              {collapsed ? "A" : "Alpha Corp"}
            </p>
          </a>
        </div>
        {/* <div className="text-xs text-white font-medium truncate">{t('hospital_name')}</div> */}
      </div>
    </aside>
  );
}
