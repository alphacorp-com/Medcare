import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Bed,
  Pill,
  Fingerprint,
  Syringe,
  Activity,
  HeartPulse,
  CreditCard,
  CalendarDays,
  CalendarClock,
  ShieldPlus,
  Stethoscope,
} from "lucide-react";

export type NavGroup = "clinical" | "administrative";

export type NavItem = {
  // Key in the `common` translation namespace.
  name: string;
  href: string;
  icon: LucideIcon;
  module: string | null;
  group?: NavGroup;
  hideBadge?: boolean;
};

// Dashboard sits ungrouped at the top; everything clinical (patient-facing
// care) is grouped together, everything administrative (scheduling, money)
// after it. Messages and Settings are rendered separately by each menu since
// neither is gated by a module. Shared by the desktop sidebar and the mobile
// header/bottom navigation so every menu lists the same modules.
export const NAV_ITEMS: NavItem[] = [
  { name: "dashboard", href: "/", icon: LayoutDashboard, module: null, hideBadge: true },
  { name: "patients", href: "/patients", icon: Users, module: "MODULE_CORE_PATIENT", group: "clinical" },
  { name: "appointments", href: "/appointments", icon: CalendarClock, module: "MODULE_APPOINTMENTS", group: "clinical" },
  { name: "stays", href: "/stays", icon: Bed, module: "MODULE_ADMISSION", group: "clinical" },
  { name: "consultations", href: "/consultations", icon: Stethoscope, module: "MODULE_ADMISSION", group: "clinical" },
  { name: "maternity", href: "/maternity", icon: HeartPulse, module: "MODULE_MATERNITY", group: "clinical" },
  { name: "disease_programs", href: "/disease-programs", icon: ShieldPlus, module: "MODULE_DISEASE_PROGRAMS", group: "clinical" },
  { name: "pharmacy", href: "/pharmacy", icon: Pill, module: "MODULE_PHARMACY", group: "clinical" },
  { name: "laboratory", href: "/laboratory", icon: Fingerprint, module: "MODULE_LAB", group: "clinical" },
  { name: "surgery", href: "/surgery", icon: Syringe, module: "MODULE_SURGERY", group: "clinical" },
  { name: "radiology", href: "/radiology", icon: Activity, module: "MODULE_RADIOLOGY", group: "clinical" },
  { name: "billing", href: "/billing", icon: CreditCard, module: "MODULE_BILLING", group: "administrative" },
  { name: "planning", href: "/planning", icon: CalendarDays, module: "MODULE_PLANNING", group: "administrative" },
];

export const NAV_GROUP_LABEL_KEY: Record<NavGroup, string> = {
  clinical: "clinical_modules",
  administrative: "administrative",
};

export function isNavHrefActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
