import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// POST /api/v1/settings/medical-acts/import
// body: { rows: { categoryCode, code, nameFr, nameEn?, basePrice, unit?, defaultPecCoveragePercent? }[] }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const body = await request.json().catch(() => null);
  const rows = body?.rows as Record<string, string>[] | undefined;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  const categories = await prisma.medicalActCategory.findMany({ where: { tenantId: session.user.tenantId } });
  const categoryByCode = new Map(categories.map((c) => [c.code.toUpperCase(), c.id]));

  let imported = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const categoryCode = row.categoryCode?.trim().toUpperCase();
    const code = row.code?.trim();
    const nameFr = row.nameFr?.trim();
    const basePrice = Number(row.basePrice);

    if (!categoryCode || !code || !nameFr || Number.isNaN(basePrice)) {
      errors.push({ row: i + 1, message: "categoryCode, code, nameFr and a numeric basePrice are required" });
      continue;
    }
    const categoryId = categoryByCode.get(categoryCode);
    if (!categoryId) {
      errors.push({ row: i + 1, message: `Unknown category code "${row.categoryCode}"` });
      continue;
    }

    try {
      await prisma.medicalAct.upsert({
        where: { tenantId_code: { tenantId: session.user.tenantId, code: code.toUpperCase() } },
        update: {
          categoryId,
          nameFr,
          nameEn: row.nameEn?.trim() || null,
          basePrice,
          unit: row.unit?.trim() || null,
          defaultPecCoveragePercent: row.defaultPecCoveragePercent ? Number(row.defaultPecCoveragePercent) || 0 : 0,
        },
        create: {
          tenantId: session.user.tenantId,
          categoryId,
          code: code.toUpperCase(),
          nameFr,
          nameEn: row.nameEn?.trim() || null,
          basePrice,
          unit: row.unit?.trim() || null,
          defaultPecCoveragePercent: row.defaultPecCoveragePercent ? Number(row.defaultPecCoveragePercent) || 0 : 0,
        },
      });
      imported++;
    } catch (error) {
      errors.push({ row: i + 1, message: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return NextResponse.json({ imported, errors });
}
