"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import {
  Settings, BedDouble, CalendarDays, DoorOpen, ShieldCheck,
  FolderTree, Stethoscope, FlaskConical, BookOpen,
  Beaker, Warehouse, Truck, ScanLine, PersonStanding,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();
  const currentUser = useAppStore((state) => state.currentUser);
  const isSysAdmin = currentUser?.role === "tenant_admin";

  const groups: NavGroup[] = [
    {
      label: t("groupClinical"),
      items: [
        { href: "/settings/admission-types", label: t("admissionTypes"), icon: BedDouble },
        { href: "/settings/appointment-types", label: t("appointmentTypes"), icon: CalendarDays },
        { href: "/settings/room-types", label: t("roomTypes"), icon: DoorOpen },
        { href: "/settings/insurance-types", label: t("insuranceTypes"), icon: ShieldCheck },
      ],
    },
    {
      label: t("groupExams"),
      items: [
        { href: "/settings/act-categories", label: t("actCategories"), icon: FolderTree },
        { href: "/settings/medical-acts", label: t("medicalActs"), icon: Stethoscope },
        { href: "/settings/exam-types", label: t("examTypes"), icon: FlaskConical },
        { href: "/settings/icd10", label: t("icd10"), icon: BookOpen },
      ],
    },
    {
      label: t("groupPharmacy"),
      items: [
        { href: "/settings/pharmaceutical-units", label: t("pharmaceuticalUnits"), icon: Beaker },
        { href: "/settings/storage-locations", label: t("storageLocations"), icon: Warehouse },
        { href: "/settings/suppliers", label: t("suppliers"), icon: Truck },
      ],
    },
    {
      label: t("groupImaging"),
      items: [
        { href: "/settings/imaging-types", label: t("imagingTypes"), icon: ScanLine },
        { href: "/settings/anatomical-zones", label: t("anatomicalZones"), icon: PersonStanding },
      ],
    },
  ];

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
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-xs font-medium border-l-4",
                    isActive
                      ? "bg-blue-50 text-blue-700 border-blue-500"
                      : "text-slate-600 hover:bg-slate-50 border-transparent"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
