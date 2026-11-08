// Liste exhaustive des cellules (code, table, cellule) que le RMA3 de MedCare peut produire : tables
// calculées + toutes les cellules du formulaire mensuel. Sert à générer les métadonnées DHIS2.
// À lancer sur une base JETABLE (DATABASE_URL locale) : écrit un locataire fictif.
//   DATABASE_URL=… npx tsx scripts/dump-rma3-cells.ts <sortie.json>
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

async function main() {
  const out = process.argv[2];
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://x@invalid/").hostname;
  if (!out || !["localhost", "127.0.0.1"].includes(host)) throw new Error("Usage : DATABASE_URL=<base locale> npx tsx scripts/dump-rma3-cells.ts <sortie.json>");
  const { default: prisma } = await import("@/lib/prisma");
  const { RMA3_MANUAL_SECTIONS, BREAKDOWN_COLUMNS } = await import("@/lib/rma3-manual/catalog");
  const { buildRma3Export } = await import("@/lib/dhis2/rma3-sync");

  const tenant = await prisma.tenant.create({ data: { slug: `dump-${randomUUID().slice(0, 8)}`, name: "dump", type: "clinic", dbSchema: `dump_${randomUUID().slice(0, 8)}` } });
  const period = await prisma.rma3ManualPeriod.create({ data: { tenantId: tenant.id, period: "202601", status: "validated", validatedAt: new Date() } });
  const by = randomUUID();
  for (const section of RMA3_MANUAL_SECTIONS)
    for (const ind of section.indicators)
      for (const col of BREAKDOWN_COLUMNS[ind.breakdown])
        await prisma.rma3ManualValue.create({ data: { tenantId: tenant.id, periodId: period.id, indicatorCode: ind.code, breakdownKey: col.key, value: 1, updatedById: by } });

  const built = await buildRma3Export(tenant.id, "202601");
  const cells = built.values.map((v) => ({ code: v.indicatorCode, table: v.tableKey, cell: v.cellKey, label: v.label, cellLabel: v.cellLabel, origin: v.origin }));
  writeFileSync(out, JSON.stringify({ duplicates: built.duplicates, cells }, null, 1));
  console.log(`cellules: ${cells.length}, codes: ${new Set(cells.map((c) => c.code)).size}, (code,table): ${new Set(cells.map((c) => c.code + c.table)).size}, doublons internes: ${built.duplicates.length}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
