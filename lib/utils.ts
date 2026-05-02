import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ModulePermission } from "./store/useAppStore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Merges tenant-level module permissions with user-specific permissions.
 * User permissions take precedence and are intersected with tenant permissions.
 */
export function mergeModulePermissions(
  tenantModules: ModulePermission[],
  userModules: ModulePermission[]
): ModulePermission[] {
  const merged: ModulePermission[] = [];

  // Create a map of tenant modules for quick lookup
  const tenantMap = new Map(tenantModules.map(m => [m.moduleId, m.actions]));

  // Process user modules, intersecting with tenant permissions
  for (const userModule of userModules) {
    const tenantActions = tenantMap.get(userModule.moduleId);
    if (tenantActions) {
      // Intersect user actions with tenant actions
      const allowedActions = userModule.actions.filter(action => tenantActions.includes(action));
      if (allowedActions.length > 0) {
        merged.push({
          moduleId: userModule.moduleId,
          actions: allowedActions
        });
      }
    }
  }

  return merged;
}
