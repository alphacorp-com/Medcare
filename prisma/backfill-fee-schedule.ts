// One-time (safely re-runnable) backfill: syncs FeeSchedule from ExamCatalogEntry.price and
// MedicalAct.basePrice for every tenant, for data that existed before the two catalogs started
// staying in sync automatically (see lib/billing/syncFeeSchedule.ts). Run once per environment
// after deploying that change: `npm run db:sync-fee-schedule`.
import 'dotenv/config';
import prisma from "../lib/prisma";

async function main() {
  let synced = 0;

  const entries = await prisma.examCatalogEntry.findMany({ where: { tenantId: { not: null } } });
  for (const entry of entries) {
    if (!entry.tenantId || entry.price == null) continue;
    await prisma.feeSchedule.upsert({
      where: { tenantId_sourceType_code: { tenantId: entry.tenantId, sourceType: "exam", code: entry.code } },
      update: { label: entry.nameFr, unitPrice: entry.price, isActive: entry.isActive },
      create: {
        tenantId: entry.tenantId,
        sourceType: "exam",
        code: entry.code,
        label: entry.nameFr,
        unitPrice: entry.price,
        isActive: entry.isActive,
      },
    });
    synced++;
  }

  const acts = await prisma.medicalAct.findMany({ where: { tenantId: { not: null } } });
  for (const act of acts) {
    if (!act.tenantId) continue;
    await prisma.feeSchedule.upsert({
      where: { tenantId_sourceType_code: { tenantId: act.tenantId, sourceType: "exam", code: act.code } },
      update: { label: act.nameFr, unitPrice: act.basePrice, isActive: act.isActive },
      create: {
        tenantId: act.tenantId,
        sourceType: "exam",
        code: act.code,
        label: act.nameFr,
        unitPrice: act.basePrice,
        isActive: act.isActive,
      },
    });
    synced++;
  }

  console.log(`Synced ${synced} fee schedule row(s) from the exam/medical-act catalogs.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
