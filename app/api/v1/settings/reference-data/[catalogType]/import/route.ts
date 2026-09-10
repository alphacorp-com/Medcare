import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { ReferenceCatalogType } from "@prisma/client";

const VALID_TYPES = Object.values(ReferenceCatalogType);

// POST /api/v1/settings/reference-data/[catalogType]/import
// body: { rows: { code, nameFr, nameEn?, color?, icon?, group? }[] }
export async function POST(request: Request, { params }: { params: Promise<{ catalogType: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { catalogType: raw } = await params;
  if (!(VALID_TYPES as string[]).includes(raw)) {
    return NextResponse.json({ error: "Invalid catalog type" }, { status: 400 });
  }
  const catalogType = raw as ReferenceCatalogType;

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
    const nameFr = row.nameFr?.trim();
    if (!code || !nameFr) {
      errors.push({ row: i + 1, message: "code and nameFr are required" });
      continue;
    }
    try {
      await prisma.referenceCatalogItem.upsert({
        where: { tenantId_catalogType_code: { tenantId: session.user.tenantId, catalogType, code: code.toUpperCase() } },
        update: {
          nameFr,
          nameEn: row.nameEn?.trim() || null,
          color: row.color?.trim() || null,
          icon: row.icon?.trim() || null,
          group: row.group?.trim() || null,
        },
        create: {
          tenantId: session.user.tenantId,
          catalogType,
          code: code.toUpperCase(),
          nameFr,
          nameEn: row.nameEn?.trim() || null,
          color: row.color?.trim() || null,
          icon: row.icon?.trim() || null,
          group: row.group?.trim() || null,
        },
      });
      imported++;
    } catch (error) {
      errors.push({ row: i + 1, message: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return NextResponse.json({ imported, errors });
}
