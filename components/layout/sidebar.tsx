"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
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
  CalendarDays
} from "lucide-react";

const navigation = [
  { name: "dashboard", href: "/", icon: LayoutDashboard, module: null, hideBadge: true },
  { name: "patients", href: "/patients", icon: Users, module: "MODULE_CORE_PATIENT" },
  { name: "stays", href: "/stays", icon: Bed, module: "MODULE_ADMISSION" },
  { name: "pharmacy", href: "/pharmacy", icon: Pill, module: "MODULE_PHARMACY" },
  { name: "laboratory", href: "/laboratory", icon: Fingerprint, module: "MODULE_LAB" },
  { name: "surgery", href: "/surgery", icon: Syringe, module: "MODULE_SURGERY" },
  { name: "radiology", href: "/radiology", icon: Activity, module: "MODULE_RADIOLOGY" },
];

export function Sidebar() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const hasModule = useAppStore((state) => state.hasModule);

  return (
    <aside className="w-60 bg-slate-900 flex flex-col border-r border-slate-700 shrink-0">
      <div className="p-4 border-b border-slate-700 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shrink-0">
          <div className="w-4 h-4 border-2 border-white rounded-full"></div>
        </div>
        <span className="text-white font-bold tracking-tight text-lg truncate">
          {t('app_name')}
        </span>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-4 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('clinical_modules')}</div>
        {navigation.map((item) => {
          const isEnabled = !item.module || hasModule(item.module);
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          if (!isEnabled) {
            return (
              <div key={item.name} className="flex items-center justify-between px-4 py-2 text-slate-400 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3 truncate">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm italic truncate">{t(item.name)}</span>
                </div>
                <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-500 text-[9px] rounded uppercase">{t('disabled')}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-4 py-2",
                isActive
                  ? "bg-slate-800 text-white border-l-4 border-blue-500 pl-3"
                  : "text-slate-400 hover:text-white hover:bg-slate-800 border-l-4 border-transparent pl-3"
              )}
            >
              <div className="flex items-center gap-3 truncate">
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="text-sm truncate">{t(item.name)}</span>
              </div>
              {!item.hideBadge && (
                <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
              )}
            </Link>
          );
        })}
        <div className="px-4 mt-6 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('administrative')}</div>

        {hasModule('MODULE_BILLING') ? (
          <Link href="/billing" className={cn("flex items-center justify-between px-4 py-2 hover:bg-slate-800 border-l-4 pl-3", pathname.startsWith('/billing') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white border-transparent")}>
            <div className="flex items-center gap-3 truncate">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate">{t('billing')}</span>
            </div>
            <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
          </Link>
        ) : (
          <div className="flex items-center justify-between px-4 py-2 text-slate-400 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3 truncate pl-3">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="text-sm italic truncate">{t('billing')}</span>
            </div>
            <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-500 text-[9px] rounded uppercase">{t('disabled')}</span>
          </div>
        )}

        {hasModule('MODULE_PLANNING') ? (
          <Link href="/planning" className={cn("flex items-center justify-between px-4 py-2 hover:bg-slate-800 border-l-4 pl-3", pathname.startsWith('/planning') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white border-transparent")}>
            <div className="flex items-center gap-3 truncate">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate">{t('planning')}</span>
            </div>
            <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded uppercase">{t('active')}</span>
          </Link>
        ) : (
          <div className="flex items-center justify-between px-4 py-2 text-slate-400 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3 truncate pl-3">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="text-sm italic truncate">{t('planning')}</span>
            </div>
            <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-700 text-slate-500 text-[9px] rounded uppercase">{t('disabled')}</span>
          </div>
        )}

        <Link href="/settings" className={cn("flex items-center justify-between px-4 py-2 hover:bg-slate-800 border-l-4 pl-3", pathname.startsWith('/settings') ? "bg-slate-800 text-white border-blue-500" : "text-slate-400 hover:text-white border-transparent")}>
          <div className="flex items-center gap-3 truncate">
            <Settings className="h-4 w-4 shrink-0" />
            <span className="text-sm truncate">{t('settings')}</span>
          </div>
        </Link>
      </nav>
      <div className="p-4 bg-slate-950 shrink-0">
        <div className="text-[10px] text-slate-500">
          {t('powered_by')}
          <a href="https://alphacorp.vercel.app" target="_blank" rel="noopener noreferrer">
            <p className='font-bold text-lg bg-clip-text text-transparent bg-gradient-to-l from-blue-700 to-fuchsia-400 animate-gradient'>
              Alpha Corp
            </p>
          </a>
        </div>
        {/* <div className="text-xs text-white font-medium truncate">{t('hospital_name')}</div> */}
      </div>
    </aside>
  );
}
