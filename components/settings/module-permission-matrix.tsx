"use client";

import { Check, Lock, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ModuleAction } from "@/types/next-auth";
import { cn } from "@/lib/utils";
import { useAssignableModules } from "@/components/settings/useAssignableModules";
import {
  LOCKED_READ_MODULE,
  actionsForModule,
  clearAllModules,
  grantReadEverywhere,
  grantedActions,
  setAllModuleActions,
  toggleModuleAction,
  type ModuleSelection,
} from "@/components/settings/module-selection";

interface ModulePermissionMatrixProps {
  title: string;
  description?: string;
  value: ModuleSelection;
  onChange: (next: ModuleSelection) => void;
  // Administrators bypass module grants entirely, so the matrix would be meaningless.
  isSystemAdmin?: boolean;
}

// Permission matrix shared by the user form (per-user grants) and the role form (default
// grants). It only edits client state — the server validates whatever is submitted
// (lib/module-permissions.ts) and enforces it on every route.
export function ModulePermissionMatrix({ title, description, value, onChange, isSystemAdmin }: ModulePermissionMatrixProps) {
  const t = useTranslations("settings");
  const modules = useAssignableModules();

  const actionLabel = (action: ModuleAction) =>
    action === "validate" ? t("validate_permission") : t(`perm_${action}`);

  const enabledCount = modules.filter((m) => grantedActions(value, m.id).length > 0).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-700">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        {!isSystemAdmin && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">{t("perm_modules_enabled", { count: enabledCount })}</span>
            <button
              type="button"
              onClick={() => onChange(grantReadEverywhere(value, modules.map((m) => m.id)))}
              className="font-semibold text-blue-600 hover:underline"
            >
              {t("perm_grant_read_all")}
            </button>
            <button
              type="button"
              onClick={() => onChange(clearAllModules())}
              className="font-semibold text-slate-500 hover:text-slate-700 hover:underline"
            >
              {t("perm_clear_all")}
            </button>
          </div>
        )}
      </div>

      {isSystemAdmin ? (
        <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-700">{t("full_system_access")}</p>
            <p className="text-xs text-blue-600 mt-0.5">{t("full_system_access_desc")}</p>
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {modules.map((mod) => {
              const available = actionsForModule(mod.id);
              const granted = grantedActions(value, mod.id);
              const isLocked = mod.id === LOCKED_READ_MODULE;
              const allGranted = granted.length === available.length;

              return (
                <li
                  key={mod.id}
                  className={cn(
                    "flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 transition-colors",
                    granted.length > 0 ? "bg-blue-50/40" : "bg-white"
                  )}
                >
                  <label className="flex items-center gap-2.5 min-w-0 sm:w-56 sm:shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allGranted}
                      // Tri-state: some but not all actions granted.
                      ref={(el) => {
                        if (el) el.indeterminate = granted.length > 0 && !allGranted;
                      }}
                      onChange={() => onChange(setAllModuleActions(value, mod.id, !allGranted))}
                      aria-label={t("perm_toggle_module", { module: mod.name })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={cn("text-sm truncate", granted.length > 0 ? "font-semibold text-slate-800" : "text-slate-600")}>
                      {mod.name}
                    </span>
                    {isLocked && (
                      <span title={t("perm_core_locked_hint")} className="text-slate-400 shrink-0">
                        <Lock className="h-3.5 w-3.5" aria-label={t("perm_core_locked_hint")} />
                      </span>
                    )}
                  </label>

                  <div className="flex flex-wrap gap-1.5 sm:ml-auto sm:justify-end">
                    {available.map((action) => {
                      const isOn = granted.includes(action);
                      const isLockedRead = isLocked && action === "read";
                      const isValidate = action === "validate";
                      return (
                        <button
                          key={action}
                          type="button"
                          aria-pressed={isOn}
                          disabled={isLockedRead}
                          onClick={() => onChange(toggleModuleAction(value, mod.id, action))}
                          title={
                            isLockedRead
                              ? t("perm_core_locked_hint")
                              : isValidate
                                ? t("validate_permission_hint")
                                : undefined
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                            "disabled:cursor-not-allowed",
                            isOn
                              ? isValidate
                                ? "border-amber-300 bg-amber-100 text-amber-800"
                                : "border-blue-600 bg-blue-600 text-white"
                              : isValidate
                                ? "border-amber-200 bg-white text-amber-700 hover:border-amber-300"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700",
                            isLockedRead && "opacity-70"
                          )}
                        >
                          {isOn && <Check className="h-3 w-3" aria-hidden="true" />}
                          {actionLabel(action)}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-slate-500">{t("perm_read_required_hint")}</p>
        </>
      )}
    </section>
  );
}
