import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { ExamCatalogDomain } from "@prisma/client";

// GET /api/v1/exam-catalog?domain=laboratory|radiology
// Read-only lookup consumed by the Laboratory/Radiology "prescribe exam" and "enter
// results" screens — replaces the previously hardcoded lib/laboratory/panels.ts and
// lib/radiology/catalog.ts. Any authenticated tenant member can read it (same access
// level as the exam catalog it replaces); editing happens under Settings → Exam Types.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain") as ExamCatalogDomain | null;
  if (domain !== "laboratory" && domain !== "radiology") {
    return NextResponse.json({ error: "domain must be laboratory or radiology" }, { status: 400 });
  }

  const entries = await prisma.examCatalogEntry.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive: true,
      examType: { domain, isActive: true },
    },
    include: { examType: true },
    orderBy: { nameFr: "asc" },
  });

  // ExamCatalogEntry.imagingCatalogItemId points at the generic ReferenceCatalogItem
  // table without a declared Prisma relation (that table is shared by 7 unrelated
  // catalogs), so resolve the modality code with a small batch lookup instead of an include.
  const imagingIds = entries.map((e) => e.imagingCatalogItemId).filter((id): id is string => Boolean(id));
  const imagingItems = imagingIds.length
    ? await prisma.referenceCatalogItem.findMany({ where: { id: { in: imagingIds } }, select: { id: true, code: true } })
    : [];
  const imagingCodeById = new Map(imagingItems.map((i) => [i.id, i.code]));

  const items = entries.map((entry) => ({
    code: entry.code,
    label: entry.nameFr,
    parameters: entry.parameters,
    modality: (entry.imagingCatalogItemId ? imagingCodeById.get(entry.imagingCatalogItemId) : null)?.toLowerCase() ?? entry.examType.code.toLowerCase(),
    requiresContrast: entry.requiresContrast ?? false,
    price: entry.price ? Number(entry.price) : null,
  }));

  return NextResponse.json(items);
}
