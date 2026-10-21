import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Session } from "next-auth";
import type { ModulePermission } from "@/types/next-auth";
import {
  DASHBOARD_WIDGETS,
  canViewWidget,
  findDashboardWidget,
  visibleDashboardWidgets,
  type DashboardViewer,
} from "@/lib/dashboard/widgets";
import { WIDGET_LOADERS } from "@/lib/dashboard/loaders";

// Run with: npm test

const ALL_LICENSED: DashboardViewer = {
  licensedModules: new Set([
    "MODULE_CORE_PATIENT",
    "MODULE_ADMISSION",
    "MODULE_APPOINTMENTS",
    "MODULE_PHARMACY",
    "MODULE_LAB",
    "MODULE_RADIOLOGY",
    "MODULE_BILLING",
  ]),
  isClinicalProvider: false,
};

function session(modules: ModulePermission[], isSystemAdmin = false): Session {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: { id: "user-1", role: "any", roleId: "role-1", isSystemAdmin, tenantId: "tenant-1", modules },
  };
}

function visibleIds(s: Session | null, viewer: DashboardViewer = ALL_LICENSED): string[] {
  return visibleDashboardWidgets(s, viewer).map((w) => w.id);
}

function widget(id: string) {
  const found = findDashboardWidget(id);
  assert.ok(found, `widget ${id} should exist`);
  return found;
}

describe("dashboard widget registry", () => {
  it("has unique ids", () => {
    const ids = DASHBOARD_WIDGETS.map((w) => w.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("has a server loader for every generic widget and none for custom ones", () => {
    for (const w of DASHBOARD_WIDGETS) {
      assert.equal(w.kind !== "custom", w.id in WIDGET_LOADERS, `loader mismatch for ${w.id}`);
    }
    for (const id of Object.keys(WIDGET_LOADERS)) {
      assert.ok(findDashboardWidget(id), `loader ${id} has no registry entry`);
    }
  });
});

describe("canViewWidget", () => {
  it("shows nothing to an unauthenticated viewer", () => {
    assert.deepEqual(visibleIds(null), []);
  });

  it("shows nothing to a user with no module grants", () => {
    assert.deepEqual(visibleIds(session([])), []);
  });

  it("does not show the patient queue without MODULE_ADMISSION read (regression: patient identities leaked)", () => {
    const cashier = session([{ moduleId: "MODULE_BILLING", actions: ["read", "create"] }]);
    assert.equal(canViewWidget(widget("patient-queue"), cashier, ALL_LICENSED), false);
    assert.deepEqual(visibleIds(cashier), ["unpaid-invoices", "payments-today", "unpaid-invoices-list"]);
  });

  it("requires the exact action, not just any grant on the module", () => {
    const labTech = session([{ moduleId: "MODULE_LAB", actions: ["read", "update"] }]);
    assert.equal(canViewWidget(widget("lab-to-perform"), labTech, ALL_LICENSED), true);
    assert.equal(canViewWidget(widget("lab-to-validate"), labTech, ALL_LICENSED), false);

    const biologist = session([{ moduleId: "MODULE_LAB", actions: ["read", "validate"] }]);
    assert.equal(canViewWidget(widget("lab-to-validate"), biologist, ALL_LICENSED), true);
  });

  it("reserves admin widgets to administrators", () => {
    const everyModule = session(
      [...ALL_LICENSED.licensedModules].map((moduleId) => ({
        moduleId,
        actions: ["read", "create", "update", "delete", "validate"],
      }))
    );
    assert.equal(canViewWidget(widget("audit-activity"), everyModule, ALL_LICENSED), false);
    assert.equal(canViewWidget(widget("subscription-status"), everyModule, ALL_LICENSED), false);

    const admin = session([], true);
    assert.equal(canViewWidget(widget("audit-activity"), admin, ALL_LICENSED), true);
  });

  it("hides widgets of unlicensed modules, even for administrators", () => {
    const admin = session([], true);
    const noLab: DashboardViewer = {
      ...ALL_LICENSED,
      licensedModules: new Set([...ALL_LICENSED.licensedModules].filter((m) => m !== "MODULE_LAB")),
    };
    const ids = visibleIds(admin, noLab);
    assert.ok(!ids.includes("lab-to-perform"));
    assert.ok(!ids.includes("pending-labs"));
    assert.ok(ids.includes("audit-activity"), "admin-only widgets don't depend on a module license");
  });

  it("shows 'my …' widgets only to clinical providers", () => {
    const doctor = session([{ moduleId: "MODULE_ADMISSION", actions: ["read"] }]);
    assert.equal(canViewWidget(widget("my-inpatients"), doctor, ALL_LICENSED), false);
    assert.equal(
      canViewWidget(widget("my-inpatients"), doctor, { ...ALL_LICENSED, isClinicalProvider: true }),
      true
    );
  });

  it("gives an administrator every licensed widget", () => {
    const admin = session([], true);
    const ids = visibleIds(admin, { ...ALL_LICENSED, isClinicalProvider: true });
    assert.deepEqual(ids, DASHBOARD_WIDGETS.map((w) => w.id));
  });
});
