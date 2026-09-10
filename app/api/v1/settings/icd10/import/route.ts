import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// POST /api/v1/settings/icd10/import — body: { rows: { code, labelFr, labelEn?, chapter? }[] }
// Upserts row-by-row so a handful of bad rows in a large CSV don't abort the whole batch.
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

  let imported = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const code = row.code?.trim();
    const labelFr = row.labelFr?.trim();
    if (!code || !labelFr) {
      errors.push({ row: i + 1, message: "code and labelFr are required" });
      continue;
    }
    try {
      await prisma.icd10Code.upsert({
        where: { tenantId_code: { tenantId: session.user.tenantId, code: code.toUpperCase() } },
        update: { labelFr, labelEn: row.labelEn?.trim() || null, chapter: row.chapter?.trim() || null },
        create: {
          tenantId: session.user.tenantId,
          code: code.toUpperCase(),
          labelFr,
          labelEn: row.labelEn?.trim() || null,
          chapter: row.chapter?.trim() || null,
        },
      });
      imported++;
    } catch (error) {
      errors.push({ row: i + 1, message: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return NextResponse.json({ imported, errors });
}
