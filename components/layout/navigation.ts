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
  ClipboardList,
} from "lucide-react";

export type NavGroup = "clinical" | "administrative";

// A sub-item: another page of the module, or a tab of the module's page (?tab=…, read by
// useUrlTab). `permission` hides it without that module permission (e.g. MODULE_HIV).
export type NavChild = {
  // Key in the `common` translation namespace.
  name: string;
  href: string;
  permission?: { module: string; action: "read" };
};

export type NavItem = {
  // Key in the `common` translation namespace.
  name: string;
  href: string;
  icon: LucideIcon;
  module: string | null;
  group?: NavGroup;
  hideBadge?: boolean;
  children?: NavChild[];
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
  {
    name: "stays",
    href: "/stays",
    icon: Bed,
    module: "MODULE_ADMISSION",
    group: "clinical",
    children: [
      { name: "nav_stays", href: "/stays" },
      { name: "consultations", href: "/consultations" },
      { name: "discharges", href: "/discharges" },
    ],
  },
  {
    name: "maternity",
    href: "/maternity",
    icon: HeartPulse,
    module: "MODULE_MATERNITY",
    group: "clinical",
    children: [
      { name: "nav_pregnancies", href: "/maternity?tab=pregnancies" },
      { name: "nav_family_planning", href: "/maternity?tab=family-planning" },
    ],
  },
  {
    name: "disease_programs",
    href: "/disease-programs",
    icon: ShieldPlus,
    module: "MODULE_DISEASE_PROGRAMS",
    group: "clinical",
    children: [
      { name: "nav_vaccination", href: "/disease-programs?tab=vaccination" },
      { name: "nav_vaccination_sessions", href: "/disease-programs?tab=sessions" },
      { name: "nav_cold_chain", href: "/disease-programs?tab=cold-chain" },
      { name: "nav_aefi", href: "/disease-programs?tab=aefi" },
      { name: "nav_malaria", href: "/disease-programs?tab=malaria" },
      { name: "nav_tuberculosis", href: "/disease-programs?tab=tuberculosis" },
      { name: "nav_nutrition", href: "/disease-programs?tab=nutrition" },
      { name: "nav_oxygen", href: "/disease-programs?tab=oxygen" },
      { name: "nav_chronic_care", href: "/disease-programs?tab=chronic" },
      { name: "nav_hiv", href: "/disease-programs?tab=hiv", permission: { module: "MODULE_HIV", action: "read" } },
    ],
  },
  {
    name: "pharmacy",
    href: "/pharmacy",
    icon: Pill,
    module: "MODULE_PHARMACY",
    group: "clinical",
    children: [
      { name: "nav_prescriptions", href: "/pharmacy?tab=prescriptions" },
      { name: "nav_inventory", href: "/pharmacy?tab=inventory" },
      { name: "nav_stock_report", href: "/pharmacy?tab=report" },
      { name: "nav_pharmacovigilance", href: "/pharmacy?tab=pharmacovigilance" },
    ],
  },
  {
    name: "laboratory",
    href: "/laboratory",
    icon: Fingerprint,
    module: "MODULE_LAB",
    group: "clinical",
    children: [
      { name: "nav_lab_exams", href: "/laboratory" },
      { name: "nav_blood_bank", href: "/blood-bank" },
    ],
  },
  { name: "surgery", href: "/surgery", icon: Syringe, module: "MODULE_SURGERY", group: "clinical" },
  { name: "radiology", href: "/radiology", icon: Activity, module: "MODULE_RADIOLOGY", group: "clinical" },
  {
    name: "billing",
    href: "/billing",
    icon: CreditCard,
    module: "MODULE_BILLING",
    group: "administrative",
    children: [
      { name: "nav_invoices", href: "/billing?tab=invoices" },
      { name: "nav_fee_schedule", href: "/billing?tab=fee_schedule" },
    ],
  },
  {
    name: "planning",
    href: "/planning",
    icon: CalendarDays,
    module: "MODULE_PLANNING",
    group: "administrative",
    children: [
      { name: "nav_rosters", href: "/planning?tab=roster" },
      { name: "nav_departments", href: "/planning?tab=departments" },
    ],
  },
  {
    // RMA3 monthly form: a sub-module of the core module (lib/sub-modules.ts).
    name: "rma3_entry",
    href: "/rma3-entry",
    icon: ClipboardList,
    module: "MODULE_RMA3",
    group: "administrative",
    children: [
      { name: "nav_rma3_form", href: "/rma3-entry?tab=form" },
      { name: "nav_rma3_identification", href: "/rma3-entry?tab=identification" },
    ],
  },
];

export const NAV_GROUP_LABEL_KEY: Record<NavGroup, string> = {
  clinical: "clinical_modules",
  administrative: "administrative",
};

export function isNavHrefActive(href: string, pathname: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");
}

// A parent is active on any of its children's pages.
export function isNavItemActive(item: NavItem, pathname: string) {
  return isNavHrefActive(item.href, pathname) || (item.children ?? []).some((c) => isNavHrefActive(c.href, pathname));
}

// The active sub-item: same page, and same ?tab= (the first tab child of the page when the
// URL has none, i.e. the page's default tab).
export function isNavChildActive(child: NavChild, siblings: readonly NavChild[], pathname: string, currentTab: string | null) {
  const [path, query] = child.href.split("?");
  if (!isNavHrefActive(path, pathname)) return false;
  // Another page of the module (e.g. /consultations): the most specific path wins.
  const samePage = siblings.filter((s) => isNavHrefActive(s.href.split("?")[0], pathname));
  const longest = Math.max(...samePage.map((s) => s.href.split("?")[0].length));
  if (path.length < longest) return false;
  const tab = new URLSearchParams(query ?? "").get("tab");
  if (!tab) return true;
  if (currentTab) return tab === currentTab;
  return samePage.find((s) => s.href.includes("tab="))?.href === child.href;
}
