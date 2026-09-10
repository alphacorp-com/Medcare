import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { ReferenceCatalogType } from "@prisma/client";

const VALID_TYPES = Object.values(ReferenceCatalogType);

function parseCatalogType(value: string): ReferenceCatalogType | null {
  return (VALID_TYPES as string[]).includes(value) ? (value as ReferenceCatalogType) : null;
}

// GET /api/v1/settings/reference-data/[catalogType] — list all items of one catalog type.
// Readable by any authenticated tenant member (not just tenant_admin) — several
// catalogs (e.g. vaccine_antigen) are consumed by clinical staff in day-to-day
// forms, not just the settings management pages. Writes stay admin-only (see POST).
export async function GET(request: Request, { params }: { params: Promise<{ catalogType: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { catalogType: raw } = await params;
  const catalogType = parseCatalogType(raw);
  if (!catalogType) {
    return NextResponse.json({ error: "Invalid catalog type" }, { status: 400 });
  }

  const items = await prisma.referenceCatalogItem.findMany({
    where: { tenantId: session.user.tenantId, catalogType },
    orderBy: [{ order: "asc" }, { nameFr: "asc" }],
  });

  return NextResponse.json(items);
}

// POST /api/v1/settings/reference-data/[catalogType] — create a new item
export async function POST(request: Request, { params }: { params: Promise<{ catalogType: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { catalogType: raw } = await params;
    const catalogType = parseCatalogType(raw);
    if (!catalogType) {
      return NextResponse.json({ error: "Invalid catalog type" }, { status: 400 });
    }

    const body = await request.json();
    const { code, nameFr, nameEn, color, icon, group, order } = body as {
      code?: string;
      nameFr?: string;
      nameEn?: string;
      color?: string;
      icon?: string;
      group?: string;
      order?: number;
    };

    if (!code?.trim() || !nameFr?.trim()) {
      return NextResponse.json({ error: "code and nameFr are required" }, { status: 400 });
    }

    const item = await prisma.referenceCatalogItem.create({
      data: {
        tenantId: session.user.tenantId,
        catalogType,
        code: code.trim().toUpperCase(),
        nameFr: nameFr.trim(),
        nameEn: nameEn?.trim() || null,
        color: color || null,
        icon: icon || null,
        group: group || null,
        order: order ?? 0,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/settings/reference-data/[catalogType]]", error);
    return NextResponse.json({ error: "Failed to create item (code may already exist)" }, { status: 400 });
  }
}
