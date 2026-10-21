import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseModulePermissions } from "@/lib/module-permissions";
import { MODULE_CATALOG } from "@/lib/module-catalog";
import { ASSIGNABLE_MODULE_IDS } from "@/components/settings/useAssignableModules";
import { SUB_MODULE_PARENT } from "@/lib/sub-modules";

describe("parseModulePermissions", () => {
  it("accepts a well-formed list, including MODULE_APPOINTMENTS", () => {
    assert.deepEqual(
      parseModulePermissions([
        { moduleId: "MODULE_CORE_PATIENT", actions: ["read"] },
        { moduleId: "MODULE_APPOINTMENTS", actions: ["read", "create", "update"] },
      ]),
      [
        { moduleId: "MODULE_CORE_PATIENT", actions: ["read"] },
        { moduleId: "MODULE_APPOINTMENTS", actions: ["read", "create", "update"] },
      ]
    );
  });

  it("accepts an empty list", () => {
    assert.deepEqual(parseModulePermissions([]), []);
  });

  it("rejects anything that isn't an array of { moduleId, actions[] }", () => {
    for (const bad of [
      null,
      "MODULE_LAB",
      { moduleId: "MODULE_LAB", actions: ["read"] },
      [null],
      [{ moduleId: 42, actions: ["read"] }],
      [{ moduleId: "MODULE_LAB" }],
      [{ moduleId: "MODULE_LAB", actions: "read" }],
    ]) {
      assert.equal(parseModulePermissions(bad), null, JSON.stringify(bad));
    }
  });

  it("rejects unknown actions", () => {
    assert.equal(parseModulePermissions([{ moduleId: "MODULE_LAB", actions: ["read", "admin"] }]), null);
  });

  it("drops module codes outside the catalog instead of failing the whole save", () => {
    assert.deepEqual(
      parseModulePermissions([
        { moduleId: "MODULE_LEGACY", actions: ["read"] },
        { moduleId: "MODULE_LAB", actions: ["read"] },
      ]),
      [{ moduleId: "MODULE_LAB", actions: ["read"] }]
    );
  });

  it("merges duplicate modules and collapses duplicate actions", () => {
    assert.deepEqual(
      parseModulePermissions([
        { moduleId: "MODULE_LAB", actions: ["read", "read"] },
        { moduleId: "MODULE_LAB", actions: ["validate"] },
      ]),
      [{ moduleId: "MODULE_LAB", actions: ["read", "validate"] }]
    );
  });
});

describe("assignable modules in the admin settings", () => {
  // Regression: MODULE_APPOINTMENTS was licensed but missing from the users/roles
  // permission matrices, so it could never be granted to a non-admin user.
  it("lists every module of the catalog and every sub-module, exactly once", () => {
    assert.deepEqual(
      [...ASSIGNABLE_MODULE_IDS].sort(),
      [...MODULE_CATALOG.map((m) => m.code), ...Object.keys(SUB_MODULE_PARENT)].sort()
    );
  });

  it("keeps MODULE_HIV when permissions are saved", () => {
    assert.deepEqual(parseModulePermissions([{ moduleId: "MODULE_HIV", actions: ["read"] }]), [{ moduleId: "MODULE_HIV", actions: ["read"] }]);
  });
});
