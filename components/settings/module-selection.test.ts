import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  actionsForModule,
  clearAllModules,
  grantReadEverywhere,
  grantedActions,
  setAllModuleActions,
  toggleModuleAction,
} from "@/components/settings/module-selection";

describe("module selection rules", () => {
  it("offers 'validate' only for lab and radiology", () => {
    assert.ok(actionsForModule("MODULE_LAB").includes("validate"));
    assert.ok(actionsForModule("MODULE_RADIOLOGY").includes("validate"));
    assert.ok(!actionsForModule("MODULE_APPOINTMENTS").includes("validate"));
  });

  it("granting any action also grants read", () => {
    const next = toggleModuleAction({}, "MODULE_APPOINTMENTS", "update");
    assert.deepEqual(next.MODULE_APPOINTMENTS, ["read", "update"]);
  });

  it("removing read removes every action of the module", () => {
    const start = { MODULE_LAB: ["read", "update", "validate"] as const };
    const next = toggleModuleAction({ MODULE_LAB: [...start.MODULE_LAB] }, "MODULE_LAB", "read");
    assert.equal(next.MODULE_LAB, undefined);
  });

  it("removing a non-read action keeps read", () => {
    const next = toggleModuleAction({ MODULE_BILLING: ["read", "create"] }, "MODULE_BILLING", "create");
    assert.deepEqual(next.MODULE_BILLING, ["read"]);
  });

  it("never removes read on patients", () => {
    assert.deepEqual(grantedActions({}, "MODULE_CORE_PATIENT"), ["read"]);
    const next = toggleModuleAction({ MODULE_CORE_PATIENT: ["read"] }, "MODULE_CORE_PATIENT", "read");
    assert.deepEqual(next.MODULE_CORE_PATIENT, ["read"]);
    assert.deepEqual(setAllModuleActions({}, "MODULE_CORE_PATIENT", false).MODULE_CORE_PATIENT, ["read"]);
  });

  it("toggles all actions of a module at once", () => {
    const all = setAllModuleActions({}, "MODULE_RADIOLOGY", true);
    assert.deepEqual(all.MODULE_RADIOLOGY, ["read", "create", "update", "delete", "validate"]);
    assert.equal(setAllModuleActions(all, "MODULE_RADIOLOGY", false).MODULE_RADIOLOGY, undefined);
  });

  it("grants read everywhere without removing existing grants", () => {
    const next = grantReadEverywhere({ MODULE_LAB: ["read", "validate"] }, ["MODULE_LAB", "MODULE_PHARMACY"]);
    assert.deepEqual(next.MODULE_LAB, ["read", "validate"]);
    assert.deepEqual(next.MODULE_PHARMACY, ["read"]);
  });

  it("clear all keeps only the mandatory patient read", () => {
    assert.deepEqual(clearAllModules(), { MODULE_CORE_PATIENT: ["read"] });
  });

  it("does not mutate the previous selection", () => {
    const before = { MODULE_LAB: ["read" as const] };
    toggleModuleAction(before, "MODULE_LAB", "update");
    assert.deepEqual(before, { MODULE_LAB: ["read"] });
  });
});
