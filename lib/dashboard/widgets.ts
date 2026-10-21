import type { Session } from "next-auth";
import type { ModuleAction } from "@/types/next-auth";
import { hasModulePermission, isAdminOrTenantAdmin } from "@/lib/permissions";

// Single source of truth for the home dashboard: which widgets exist, what each one
// requires, and how it is laid out. Both the page (to decide what to render) and
// GET /api/v1/dashboard/widgets/[id] (to decide what to serve) go through
// canViewWidget() below, so hiding a widget and refusing its data can never drift apart.
//
// Widgets are gated on module permissions — never on the role *name*, which is
// admin-defined and renamable (see Role in prisma/schema.prisma). A role still gets
// "its" dashboard, because its defaultModules are what grant those permissions.

export type WidgetRequirement =
  | {
      kind: "module";
      module: string;
      action: ModuleAction;
      // "My …" widgets only make sense for users who can be an attending doctor /
      // prescriber (Role.isClinicalProvider). Their data is always filtered on the
      // caller's own id server-side; this flag only avoids showing an always-empty panel.
      clinicalProviderOnly?: boolean;
    }
  | { kind: "admin" };

// "stat" and "amount" render as KPI tiles; "list" as a generic panel; "custom" widgets
// keep their own bespoke component and API route.
export type WidgetKind = "stat" | "amount" | "list" | "custom";

export interface DashboardWidget {
  id: string;
  kind: WidgetKind;
  requirement: WidgetRequirement;
  // Only for panels: "wide" spans two grid columns on large screens.
  size?: "normal" | "wide";
  // Polling interval of generic widgets (0 = load once). Custom widgets poll on their
  // own schedule, so for them this only documents it.
  refreshMs: number;
}

const MINUTE = 60 * 1000;

export const DASHBOARD_WIDGETS: readonly DashboardWidget[] = [
  // ── KPI tiles ────────────────────────────────────────────────────────────
  { id: "active-consultations", kind: "stat", requirement: { kind: "module", module: "MODULE_ADMISSION", action: "read" }, refreshMs: MINUTE },
  { id: "er-wait-time", kind: "stat", requirement: { kind: "module", module: "MODULE_ADMISSION", action: "read" }, refreshMs: MINUTE },
  { id: "admissions-today", kind: "stat", requirement: { kind: "module", module: "MODULE_ADMISSION", action: "read" }, refreshMs: 5 * MINUTE },
  { id: "bed-occupancy", kind: "stat", requirement: { kind: "module", module: "MODULE_ADMISSION", action: "read" }, refreshMs: 5 * MINUTE },
  { id: "appointments-today", kind: "stat", requirement: { kind: "module", module: "MODULE_APPOINTMENTS", action: "read" }, refreshMs: 5 * MINUTE },
  { id: "pending-labs", kind: "stat", requirement: { kind: "module", module: "MODULE_LAB", action: "read" }, refreshMs: 2 * MINUTE },
  { id: "unpaid-invoices", kind: "amount", requirement: { kind: "module", module: "MODULE_BILLING", action: "read" }, refreshMs: 5 * MINUTE },
  { id: "payments-today", kind: "amount", requirement: { kind: "module", module: "MODULE_BILLING", action: "read" }, refreshMs: 5 * MINUTE },

  // ── Personal panels (clinical providers) ─────────────────────────────────
  { id: "my-inpatients", kind: "list", requirement: { kind: "module", module: "MODULE_ADMISSION", action: "read", clinicalProviderOnly: true }, refreshMs: MINUTE },
  { id: "my-appointments-today", kind: "list", requirement: { kind: "module", module: "MODULE_APPOINTMENTS", action: "read", clinicalProviderOnly: true }, refreshMs: 2 * MINUTE },
  { id: "my-recent-results", kind: "list", requirement: { kind: "module", module: "MODULE_LAB", action: "read", clinicalProviderOnly: true }, refreshMs: 2 * MINUTE },

  // ── Facility-wide panels ─────────────────────────────────────────────────
  { id: "patient-queue", kind: "custom", size: "wide", requirement: { kind: "module", module: "MODULE_ADMISSION", action: "read" }, refreshMs: 30 * 1000 },
  { id: "lab-to-perform", kind: "list", requirement: { kind: "module", module: "MODULE_LAB", action: "update" }, refreshMs: MINUTE },
  { id: "lab-to-validate", kind: "list", requirement: { kind: "module", module: "MODULE_LAB", action: "validate" }, refreshMs: MINUTE },
  { id: "radiology-to-perform", kind: "list", requirement: { kind: "module", module: "MODULE_RADIOLOGY", action: "update" }, refreshMs: MINUTE },
  { id: "radiology-to-validate", kind: "list", requirement: { kind: "module", module: "MODULE_RADIOLOGY", action: "validate" }, refreshMs: MINUTE },
  { id: "pharmacy-pending-rx", kind: "list", requirement: { kind: "module", module: "MODULE_PHARMACY", action: "read" }, refreshMs: MINUTE },
  { id: "stock-alerts", kind: "custom", requirement: { kind: "module", module: "MODULE_PHARMACY", action: "read" }, refreshMs: 10 * MINUTE },
  { id: "unpaid-invoices-list", kind: "list", requirement: { kind: "module", module: "MODULE_BILLING", action: "read" }, refreshMs: 5 * MINUTE },

  // ── Administration ───────────────────────────────────────────────────────
  { id: "subscription-status", kind: "custom", requirement: { kind: "admin" }, refreshMs: 0 },
  { id: "audit-activity", kind: "custom", requirement: { kind: "admin" }, refreshMs: 5 * MINUTE },
];

export function findDashboardWidget(id: string): DashboardWidget | undefined {
  return DASHBOARD_WIDGETS.find((widget) => widget.id === id);
}

// Facts about the viewer that aren't in the session and must be resolved server-side
// (see lib/dashboard/viewer.ts).
export interface DashboardViewer {
  // Module codes the tenant's license currently enables. Mirrors the sidebar, which
  // shows a module only when it is both licensed and granted to the user.
  licensedModules: ReadonlySet<string>;
  isClinicalProvider: boolean;
}

export function canViewWidget(
  widget: DashboardWidget,
  session: Session | null | undefined,
  viewer: DashboardViewer
): boolean {
  if (!session?.user) return false;

  const requirement = widget.requirement;
  if (requirement.kind === "admin") return isAdminOrTenantAdmin(session);

  // An administrator bypasses per-module grants, but not the license: an unlicensed
  // module stays hidden for everyone, as in the sidebar.
  if (!viewer.licensedModules.has(requirement.module)) return false;
  if (!hasModulePermission(session, requirement.module, requirement.action)) return false;
  if (requirement.clinicalProviderOnly && !viewer.isClinicalProvider) return false;
  return true;
}

export function visibleDashboardWidgets(
  session: Session | null | undefined,
  viewer: DashboardViewer
): DashboardWidget[] {
  return DASHBOARD_WIDGETS.filter((widget) => canViewWidget(widget, session, viewer));
}
