import 'dotenv/config';
import prisma from '../lib/prisma';
import { MODULE_CATALOG, ensureModuleCatalog } from '../lib/module-catalog';

// Seeds only the tenant-independent MedCare module catalog (defined in
// lib/module-catalog.ts). This is required reference data, not demo content —
// it is also created on demand when a license is applied, so running this is
// only needed to refresh names/descriptions of existing rows.
//
// No Tenant, no TenantUser, no demo hospital: a fresh on-prem install is
// onboarded by its real admin through /setup, which creates the real tenant
// and first tenant_admin — this script must not race or duplicate that.
async function main() {
  console.log('Seeding module catalog...');
  await ensureModuleCatalog({ refresh: true });
  console.log(`Module catalog ensured (${MODULE_CATALOG.length} modules).`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
