// Applies the standard result sheets (lib/exam-catalog/standard-parameters.ts) to the exam
// catalog entries that already exist, for every tenant: `npm run db:sync-exam-parameters`.
// Matches on ExamCatalogEntry.code and only rewrites `parameters` (plus the ECBU label,
// renamed alongside) — prices, names and anything a tenant configured are left as they are.
// Entries whose code isn't in the standard catalog are untouched. Safe to re-run.
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { LAB_PARAMETERS, RADIOLOGY_PARAMETERS } from '../lib/exam-catalog/standard-parameters';

const STANDARD: Record<string, unknown[]> = { ...LAB_PARAMETERS, ...RADIOLOGY_PARAMETERS };

async function main() {
  const entries = await prisma.examCatalogEntry.findMany({
    where: { code: { in: Object.keys(STANDARD) } },
    select: { id: true, code: true, nameFr: true },
  });

  for (const entry of entries) {
    await prisma.examCatalogEntry.update({
      where: { id: entry.id },
      data: {
        parameters: STANDARD[entry.code] as unknown as Prisma.InputJsonValue,
        ...(entry.code === 'UA' && entry.nameFr === "Analyse d'urine (ECBU)"
          ? { nameFr: 'Examen cytobactériologique des urines (ECBU)', nameEn: 'Urinalysis and urine culture' }
          : {}),
      },
    });
    console.log(`  ${entry.code.padEnd(20)} ${STANDARD[entry.code].length} paramètres`);
  }
  console.log(`Exam parameters synced on ${entries.length} catalog entries.`);
}

main()
  .catch((e) => {
    console.error('Error syncing exam parameters:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
