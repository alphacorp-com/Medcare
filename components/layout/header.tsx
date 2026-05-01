"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Languages } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils";

import { signOut } from "next-auth/react";

export function Header() {
  const t = useTranslations('common');
  const tr = useTranslations('roles');
  const locale = useLocale();
  const pathname = usePathname();
  const { currentUser, setUser, setActiveModules } = useAppStore();
  const router = useRouter();

  const handleLogout = async () => {
    setUser(null);
    setActiveModules([]);
    await signOut({ callbackUrl: `/${locale}/login` });
  };

  const handleLocaleChange = (newLocale: string) => {
    router.push(pathname, { locale: newLocale as any });
  };

  const [orgInfo, setOrgInfo] = useState({
    name: '',
    address: '',
    logoUrl: ''
  });

  const roleTranslations: Record<string, string> = {
    "System Administrator": tr('admin'),
    "Lead Physician": tr('physician'),
    "Head Nurse": tr('nurse'),
    "Pharmacist": tr('pharmacist'),
    "Lab Technician": tr('lab'),
    "Billing Manager": tr('billing'),
    "HR Director": tr('hr')
  };

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const response = await fetch('/api/v1/settings/organization');
        if (!response.ok) return;
        const data = await response.json();
        setOrgInfo({
          name: data.name || '',
          address: data.address || '',
          logoUrl: data.logoUrl || ''
        });
      } catch (error) {
        console.error('Failed to load organization info', error);
      }
    };

    fetchOrg();
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-slate-200 bg-slate-50 text-slate-700">
          {orgInfo.logoUrl ? (
            <AvatarImage src={orgInfo.logoUrl} alt={orgInfo.name || t('hospital_name')} />
          ) : (
            <AvatarFallback>H</AvatarFallback>
          )}
        </Avatar>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">{orgInfo.name || t('hospital_name')}</div>
          <div className="text-[11px] text-slate-500">{orgInfo.address || t('hospital_address')}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 focus:outline-none uppercase bg-slate-50 px-2 py-1 rounded border border-slate-200">
            <Languages className="w-3.5 h-3.5" />
            {locale}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => handleLocaleChange('en')} className={cn("text-xs cursor-pointer", locale === 'en' && "bg-blue-50 text-blue-700 font-bold")}>English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLocaleChange('fr')} className={cn("text-xs cursor-pointer", locale === 'fr' && "bg-blue-50 text-blue-700 font-bold")}>Français</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">
            {currentUser?.role ? (roleTranslations[currentUser.role] || currentUser.role) : t('view')}
          </span>
          <div className="text-right leading-none">
            <div className="text-xs font-semibold uppercase">{currentUser?.fullName}</div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center focus:outline-none">
            <Avatar className="h-8 w-8 border border-slate-300 hover:opacity-80 transition-opacity">
              <AvatarImage src="" alt={currentUser?.fullName || t('view')} />
              <AvatarFallback className="bg-slate-200">{currentUser?.fullName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('settings')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>{t('settings')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 font-medium cursor-pointer focus:text-red-700 focus:bg-red-50">{t('logout')}</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
