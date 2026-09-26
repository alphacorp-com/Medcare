"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import StandardMobileTemplate from "@/components/layout/mobile/StandardMobileTemplate";
import { SettingsMobileBackButton } from "@/components/settings/settings-ui";
import {
  useSettingsNavGroups,
  isSettingsNavItemActive,
  findSettingsNavGroup,
} from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("settings.nav");
  const ts = useTranslations("settings");
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const currentUser = useAppStore((state) => state.currentUser);
  const isSysAdmin = currentUser?.isSystemAdmin === true;
  const groups = useSettingsNavGroups();

  if (isMobile) {
    // The settings home renders its own mobile menu (which replaces this sidebar).
    if (pathname === "/settings") return <>{children}</>;

    // A user's activity log is reached from the Personnel section, so it returns there.
    const isUserActivity = pathname.startsWith("/settings/users/");
    const backHref = isUserActivity ? "/settings?tab=users" : "/settings";
    const backLabel = isUserActivity ? ts("users_roles") : t("all_settings");
    const subtitle = isUserActivity ? ts("users_roles") : findSettingsNavGroup(groups, pathname)?.label;

    return (
      <StandardMobileTemplate
        title={ts("title")}
        subtitle={subtitle}
        showSearchSlot={false}
        actions={<SettingsMobileBackButton href={backHref} label={backLabel} />}
      >
        {children}
      </StandardMobileTemplate>
    );
  }

  // The "General" tab (profile, password, etc.) stays available to every user —
  // only the tenant-configuration groups below it are admin-only, mirroring how
  // the existing tabbed settings page hides (not blocks) its own admin-only tabs.
  return (
    <div className="flex h-full gap-4 min-h-0">
      <nav className="w-56 shrink-0 overflow-y-auto bg-white rounded border border-slate-200 shadow-sm py-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-medium border-l-4",
            pathname === "/settings"
              ? "bg-blue-50 text-blue-700 border-blue-500"
              : "text-slate-600 hover:bg-slate-50 border-transparent"
          )}
        >
          <Settings className="h-3.5 w-3.5 shrink-0" />
          {t("general")}
        </Link>

        {isSysAdmin && groups.map((group) => (
          <div key={group.label} className="mt-3">
            <div className="px-4 mb-1 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              {group.label}
            </div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-medium border-l-4",
                  isSettingsNavItemActive(item, pathname)
                    ? "bg-blue-50 text-blue-700 border-blue-500"
                    : "text-slate-600 hover:bg-slate-50 border-transparent"
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
