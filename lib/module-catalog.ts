import { ModuleCategory, PlanTier } from "@prisma/client";
import prisma from "@/lib/prisma";

// The tenant-independent MedCare module catalog. This is required reference
// data, not demo content: syncTenantModulesFromLicense() (lib/tenant-licensing.ts)
// maps the module codes inside an AlphaCorp-issued license onto TenantModule
// rows by looking them up here. It lives in code (not only in the seed script)
// so a fresh install that never ran `npm run seed` still gets its modules
// enabled when a license is applied.
export const MODULE_CATALOG: Array<{
  code: string;
  name: string;
  category: ModuleCategory;
  tier: PlanTier;
  description: string;
  isPublished: boolean;
}> = [
  {
    code: "MODULE_CORE_PATIENT",
    name: "Patient Management",
    category: "clinical",
    tier: "core",
    description: "Manage patient records, appointments, and clinical workflows.",
    isPublished: true,
  },
  {
    code: "MODULE_ADMISSION",
    name: "Admissions",
    category: "clinical",
    tier: "core",
    description: "Track admissions, bed assignments and patient flow.",
    isPublished: true,
  },
  {
    code: "MODULE_PHARMACY",
    name: "Pharmacy",
    category: "clinical",
    tier: "core",
    description: "Manage medication dispensing, prescriptions and stock.",
    isPublished: true,
  },
  {
    code: "MODULE_LAB",
    name: "Laboratory",
    category: "clinical",
    tier: "core",
    description: "Manage lab requests, results and test tracking.",
    isPublished: true,
  },
  {
    code: "MODULE_SURGERY",
    name: "Surgery",
    category: "clinical",
    tier: "core",
    description: "Coordinate surgical scheduling and operative workflows.",
    isPublished: true,
  },
  {
    code: "MODULE_RADIOLOGY",
    name: "Radiology",
    category: "clinical",
    tier: "core",
    description: "Manage imaging orders, reports and radiology workflows.",
    isPublished: true,
  },
  {
    code: "MODULE_BILLING",
    name: "Billing",
    category: "finance",
    tier: "core",
    description: "Handle invoicing, payments and billing records.",
    isPublished: true,
  },
  {
    code: "MODULE_PLANNING",
    name: "Planning",
    category: "admin",
    tier: "core",
    description: "Manage facility planning, staffing and resource allocation.",
    isPublished: true,
  },
  {
    code: "MODULE_MATERNITY",
    name: "Maternity",
    category: "clinical",
    tier: "core",
    description: "Track pregnancies, antenatal visits, delivery/partograph and newborn records.",
    isPublished: true,
  },
  {
    code: "MODULE_DISEASE_PROGRAMS",
    name: "Disease Programs",
    category: "clinical",
    tier: "core",
    description: "Track immunizations, malaria cases and TB registration/follow-up for national program reporting.",
    isPublished: true,
  },
  {
    code: "MODULE_APPOINTMENTS",
    name: "Appointments",
    category: "clinical",
    tier: "core",
    description: "Book patient appointments, manage doctor agendas, and check patients in on arrival.",
    isPublished: true,
  },
];

// Upserts every catalog entry. `refresh` also rewrites name/description/etc.
// of existing rows (what the seed script wants); without it, rows that
// already exist are left untouched and only missing ones are created.
export async function ensureModuleCatalog({ refresh = false }: { refresh?: boolean } = {}): Promise<void> {
  if (!refresh) {
    const existing = await prisma.module.findMany({ select: { code: true } });
    const existingCodes = new Set(existing.map((m) => m.code));
    const missing = MODULE_CATALOG.filter((m) => !existingCodes.has(m.code));
    if (missing.length === 0) return;
    await prisma.module.createMany({ data: missing, skipDuplicates: true });
    return;
  }

  for (const definition of MODULE_CATALOG) {
    const { code, ...fields } = definition;
    await prisma.module.upsert({
      where: { code },
      update: fields,
      create: definition,
    });
  }
}
