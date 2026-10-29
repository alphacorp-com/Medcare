"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { isSettingsNavItemActive, useSettingsNavGroups } from "@/components/settings/settings-nav";
import { cn } from "@/lib/utils";

// Compact navigation between the settings screens, for widths where the sidebar does not
// fit (below `xl`): the application's own menu already takes 240px, and a second sidebar
// would leave a tablet's content area unusably narrow. A native <select> is used on purpose:
// it is keyboard- and screen-reader-accessible by default and opens the OS picker on touch.
//
// "General" (profile, password, organisation…) is open to everyone; the groups of
// tenant-configuration screens are only listed for administrators, like the sidebar.
export function SettingsNavPicker({ isAdmin, className }: { isAdmin: boolean; className?: string }) {
  const t = useTranslations("settings.nav");
  const router = useRouter();
  const pathname = usePathname();
  const groups = useSettingsNavGroups();

  const activeItem = groups.flatMap((group) => group.items).find((item) => isSettingsNavItemActive(item, pathname));
  // A user's activity log belongs to the "Personnel" section of the general page.
  const value = activeItem?.href ?? "/settings";

  return (
    <div className={cn("relative", className)}>
      <label htmlFor="settings-nav-picker" className="sr-only">{t("all_settings")}</label>
      <select
        id="settings-nav-picker"
        value={value}
        onChange={(event) => router.push(event.target.value)}
        className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <option value="/settings">{t("general")}</option>
        {isAdmin &&
          groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => (
                <option key={item.href} value={item.href}>{item.label}</option>
              ))}
            </optgroup>
          ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
