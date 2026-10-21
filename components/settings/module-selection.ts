import type { ModuleAction } from "@/types/next-auth";

// Editing state of a permission matrix: module code → granted actions. Pure functions so
// the rules are unit-tested (components/settings/module-selection.test.ts) and shared by
// the user and role forms.
export type ModuleSelection = Record<string, ModuleAction[]>;

const BASE_ACTIONS: readonly ModuleAction[] = ["read", "create", "update", "delete"];

// "validate" (signing off results) only exists for the lab and radiology modules.
const VALIDATING_MODULES = new Set(["MODULE_LAB", "MODULE_RADIOLOGY"]);

// Every user keeps read access to patients: it is what every other module builds on.
export const LOCKED_READ_MODULE = "MODULE_CORE_PATIENT";

export function actionsForModule(moduleId: string): readonly ModuleAction[] {
  return VALIDATING_MODULES.has(moduleId) ? [...BASE_ACTIONS, "validate"] : BASE_ACTIONS;
}

// Display order, whatever order the actions were stored in.
function ordered(moduleId: string, actions: Iterable<ModuleAction>): ModuleAction[] {
  const set = new Set(actions);
  return actionsForModule(moduleId).filter((a) => set.has(a));
}

function withModule(selection: ModuleSelection, moduleId: string, actions: Set<ModuleAction>): ModuleSelection {
  if (moduleId === LOCKED_READ_MODULE) actions.add("read");
  const next = { ...selection };
  if (actions.size > 0) next[moduleId] = ordered(moduleId, actions);
  else delete next[moduleId];
  return next;
}

export function grantedActions(selection: ModuleSelection, moduleId: string): ModuleAction[] {
  const stored = selection[moduleId] ?? [];
  return moduleId === LOCKED_READ_MODULE ? ordered(moduleId, [...stored, "read"]) : ordered(moduleId, stored);
}

// Read is the prerequisite of every other action: the module's menu entry and pages only
// open with read (see hasModule in lib/store/useAppStore.ts), so granting e.g. "update"
// alone would give a permission the user can never reach. Granting any action therefore
// grants read, and removing read removes everything.
export function toggleModuleAction(selection: ModuleSelection, moduleId: string, action: ModuleAction): ModuleSelection {
  const current = new Set(grantedActions(selection, moduleId));
  if (current.has(action)) {
    if (action === "read") current.clear();
    else current.delete(action);
  } else {
    current.add(action);
    current.add("read");
  }
  return withModule(selection, moduleId, current);
}

export function setAllModuleActions(selection: ModuleSelection, moduleId: string, enabled: boolean): ModuleSelection {
  return withModule(selection, moduleId, new Set(enabled ? actionsForModule(moduleId) : []));
}

// Adds read to every listed module, keeping whatever else was already granted.
export function grantReadEverywhere(selection: ModuleSelection, moduleIds: readonly string[]): ModuleSelection {
  return moduleIds.reduce(
    (acc, moduleId) => withModule(acc, moduleId, new Set([...grantedActions(acc, moduleId), "read"])),
    selection
  );
}

export function clearAllModules(): ModuleSelection {
  return { [LOCKED_READ_MODULE]: ["read"] };
}
