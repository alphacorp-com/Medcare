"use client";

import { useTranslations } from "next-intl";
import {
  BedDouble, BedSingle, CalendarDays, DoorOpen, ShieldCheck,
  FolderTree, Stethoscope, FlaskConical, BookOpen,
  Beaker, Warehouse, Truck, ScanLine, PersonStanding, Syringe, FileText, Clock,
  type LucideIcon,
} from "lucide-react";

export type SettingsNavItem = { href: string; label: string; icon: LucideIcon };
export type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

// Tenant reference-data pages living under /settings/* — shared by the desktop sidebar
// (settings/layout.tsx) and the mobile settings menu (settings/page.tsx) so both stay in sync.
export function useSettingsNavGroups(): SettingsNavGroup[] {
  const t = useTranslations("settings.nav");

  return [
    {
      label: t("groupClinical"),
      items: [
        { href: "/settings/admission-types", label: t("admissionTypes"), icon: BedDouble },
        { href: "/settings/appointment-types", label: t("appointmentTypes"), icon: CalendarDays },
        { href: "/settings/doctor-availability", label: t("doctorAvailability"), icon: Clock },
        { href: "/settings/room-types", label: t("roomTypes"), icon: DoorOpen },
        { href: "/settings/insurance-types", label: t("insuranceTypes"), icon: ShieldCheck },
        { href: "/settings/beds", label: t("beds"), icon: BedSingle },
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
    {
      label: t("groupDiseasePrograms"),
      items: [
        { href: "/settings/vaccine-antigens", label: t("vaccineAntigens"), icon: Syringe },
      ],
    },
    {
      label: t("groupReports"),
      items: [
        { href: "/settings/reports", label: t("rma3Report"), icon: FileText },
      ],
    },
  ];
}

export function isSettingsNavItemActive(item: SettingsNavItem, pathname: string) {
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function findSettingsNavGroup(groups: SettingsNavGroup[], pathname: string) {
  return groups.find((group) => group.items.some((item) => isSettingsNavItemActive(item, pathname))) ?? null;
}
