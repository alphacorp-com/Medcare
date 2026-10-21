import type { ModuleAction } from "@/types/next-auth";
import { MODULE_CATALOG } from "@/lib/module-catalog";
import { SUB_MODULE_PARENT } from "@/lib/sub-modules";

// Same shape as ModulePermission, declared as a type alias: unlike an interface it is
// assignable to Prisma's InputJsonValue, so it can be written to the JSON columns as is.
export type StoredModulePermission = { moduleId: string; actions: ModuleAction[] };

// Licensed modules and their sub-modules (e.g. MODULE_HIV).
const KNOWN_MODULES = new Set([...MODULE_CATALOG.map((m) => m.code), ...Object.keys(SUB_MODULE_PARENT)]);
const KNOWN_ACTIONS: ReadonlySet<string> = new Set<ModuleAction>(["read", "create", "update", "delete", "validate"]);

// Validates a module-permission list from a request body (TenantUser.modules,
// Role.defaultModules) before it is stored. Those JSON columns feed every authorization
// check (hasModulePermission reads `actions` as an array), so a malformed entry must be
// rejected here rather than stored and crash later. Returns null when the input is
// malformed (wrong shape, unknown action); duplicate actions are collapsed and modules
// listed twice are merged.
//
// Entries for a module code that isn't in the catalog are dropped rather than rejected:
// the settings UI round-trips whatever is already stored, so a legacy/decommissioned
// code would otherwise block every later save of that user or role. Such an entry
// grants nothing anyway — no route checks a code outside the catalog.
export function parseModulePermissions(input: unknown): StoredModulePermission[] | null {
  if (!Array.isArray(input)) return null;

  const merged = new Map<string, Set<ModuleAction>>();
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) return null;
    const { moduleId, actions } = entry as { moduleId?: unknown; actions?: unknown };
    if (typeof moduleId !== "string") return null;
    if (!Array.isArray(actions) || !actions.every((a) => typeof a === "string" && KNOWN_ACTIONS.has(a))) {
      return null;
    }
    if (!KNOWN_MODULES.has(moduleId)) continue;
    const set = merged.get(moduleId) ?? new Set<ModuleAction>();
    for (const action of actions as ModuleAction[]) set.add(action);
    merged.set(moduleId, set);
  }

  return [...merged].map(([moduleId, actions]) => ({ moduleId, actions: [...actions] }));
}
