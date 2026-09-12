import 'dotenv/config';
import { ModuleCategory, PlanTier } from '@prisma/client';
import prisma from '../lib/prisma';

// Seeds only the tenant-independent MedCare module catalog. This is required
// reference data, not demo content — lib/tenant-licensing.ts's
// syncTenantModulesFromLicense() maps the module codes inside an
// AlphaCorp-issued license onto TenantModule rows by looking them up here.
//
// No Tenant, no TenantUser, no demo hospital: a fresh on-prem install is
// onboarded by its real admin through /setup, which creates the real tenant
// and first tenant_admin — this script must not race or duplicate that.
async function main() {
  console.log('Seeding module catalog...');

  const moduleDefinitions: Array<{
    code: string;
    name: string;
    category: ModuleCategory;
    tier: PlanTier;
    description: string;
    isPublished: boolean;
  }> = [
    {
      code: 'MODULE_CORE_PATIENT',
      name: 'Patient Management',
      category: 'clinical',
      tier: 'core',
      description: 'Manage patient records, appointments, and clinical workflows.',
      isPublished: true,
    },
    {
      code: 'MODULE_ADMISSION',
      name: 'Admissions',
      category: 'clinical',
      tier: 'core',
      description: 'Track admissions, bed assignments and patient flow.',
      isPublished: true,
    },
    {
      code: 'MODULE_PHARMACY',
      name: 'Pharmacy',
      category: 'clinical',
      tier: 'core',
      description: 'Manage medication dispensing, prescriptions and stock.',
      isPublished: true,
    },
    {
      code: 'MODULE_LAB',
      name: 'Laboratory',
      category: 'clinical',
      tier: 'core',
      description: 'Manage lab requests, results and test tracking.',
      isPublished: true,
    },
    {
      code: 'MODULE_SURGERY',
      name: 'Surgery',
      category: 'clinical',
      tier: 'core',
      description: 'Coordinate surgical scheduling and operative workflows.',
      isPublished: true,
    },
    {
      code: 'MODULE_RADIOLOGY',
      name: 'Radiology',
      category: 'clinical',
      tier: 'core',
      description: 'Manage imaging orders, reports and radiology workflows.',
      isPublished: true,
    },
    {
      code: 'MODULE_BILLING',
      name: 'Billing',
      category: 'finance',
      tier: 'core',
      description: 'Handle invoicing, payments and billing records.',
      isPublished: true,
    },
    {
      code: 'MODULE_PLANNING',
      name: 'Planning',
      category: 'admin',
      tier: 'core',
      description: 'Manage facility planning, staffing and resource allocation.',
      isPublished: true,
    },
    {
      code: 'MODULE_MATERNITY',
      name: 'Maternity',
      category: 'clinical',
      tier: 'core',
      description: 'Track pregnancies, antenatal visits, delivery/partograph and newborn records.',
      isPublished: true,
    },
    {
      code: 'MODULE_DISEASE_PROGRAMS',
      name: 'Disease Programs',
      category: 'clinical',
      tier: 'core',
      description: 'Track immunizations, malaria cases and TB registration/follow-up for national program reporting.',
      isPublished: true,
    },
    {
      code: 'MODULE_APPOINTMENTS',
      name: 'Appointments',
      category: 'clinical',
      tier: 'core',
      description: 'Book patient appointments, manage doctor agendas, and check patients in on arrival.',
      isPublished: true,
    },
  ];

  for (const moduleDefinition of moduleDefinitions) {
    await prisma.module.upsert({
      where: { code: moduleDefinition.code },
      update: {
        name: moduleDefinition.name,
        category: moduleDefinition.category,
        tier: moduleDefinition.tier,
        description: moduleDefinition.description,
        isPublished: moduleDefinition.isPublished,
      },
      create: { ...moduleDefinition },
    });
  }

  console.log(`Module catalog ensured (${moduleDefinitions.length} modules).`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
