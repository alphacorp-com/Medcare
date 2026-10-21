"use client";

import { useTranslations } from "next-intl";

// Modules an administrator can grant, in display order — shared by the per-user
// (users-management) and per-role default (roles-management) permission matrices so the
// two can't drift apart. Must list every code of MODULE_CATALOG (lib/module-catalog.ts);
// a module missing here can't be granted to non-admin users at all.
export const ASSIGNABLE_MODULE_IDS = [
  "MODULE_CORE_PATIENT",
  "MODULE_ADMISSION",
  "MODULE_APPOINTMENTS",
  "MODULE_PHARMACY",
  "MODULE_LAB",
  "MODULE_SURGERY",
  "MODULE_RADIOLOGY",
  "MODULE_BILLING",
  "MODULE_PLANNING",
  "MODULE_MATERNITY",
  "MODULE_DISEASE_PROGRAMS",
] as const;

export function useAssignableModules(): Array<{ id: string; name: string }> {
  const tp = useTranslations("patients");
  const tadm = useTranslations("admissions");
  const tappt = useTranslations("appointments");
  const tph = useTranslations("pharmacy");
  const tlab = useTranslations("lab");
  const trad = useTranslations("radiology");
  const tsurg = useTranslations("surgery");
  const tbill = useTranslations("billing");
  const tplan = useTranslations("planning");
  const tmat = useTranslations("maternity");
  const tdp = useTranslations("diseasePrograms");

  const names: Record<(typeof ASSIGNABLE_MODULE_IDS)[number], string> = {
    MODULE_CORE_PATIENT: tp("module_title"),
    MODULE_ADMISSION: tadm("title"),
    MODULE_APPOINTMENTS: tappt("module_title"),
    MODULE_PHARMACY: tph("title"),
    MODULE_LAB: tlab("title"),
    MODULE_SURGERY: tsurg("title"),
    MODULE_RADIOLOGY: trad("title"),
    MODULE_BILLING: tbill("title"),
    MODULE_PLANNING: tplan("title"),
    MODULE_MATERNITY: tmat("title"),
    MODULE_DISEASE_PROGRAMS: tdp("module_title"),
  };

  return ASSIGNABLE_MODULE_IDS.map((id) => ({ id, name: names[id] }));
}
