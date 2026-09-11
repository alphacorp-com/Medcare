import 'dotenv/config';
import prisma from '../lib/prisma';

// Wipes every application table's ROWS in both schemas (public,
// tenant_template) while leaving the schema itself and migration history
// intact — for resetting a dev/test database to a clean slate before
// onboarding through /setup again. Uses plain TRUNCATE over the normal
// connection rather than `prisma migrate reset`, which needs an advisory
// lock that hangs against Neon's pooled (pgbouncer transaction-mode)
// connection string.
//
// DESTRUCTIVE. Never run this against a database holding real client data.
async function main() {
  const tables = await prisma.$queryRaw<{ schemaname: string; tablename: string }[]>`
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('public', 'tenant_template')
      AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    console.log('No tables found to truncate.');
    return;
  }

  const targetList = tables.map((t) => `"${t.schemaname}"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${targetList} RESTART IDENTITY CASCADE;`);

  console.log(`Truncated ${tables.length} tables across public/tenant_template.`);
  console.log('Run `npm run seed` next to restore the module catalog, then use /setup to onboard.');
}

main()
  .catch((e) => {
    console.error('Error during reset:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
