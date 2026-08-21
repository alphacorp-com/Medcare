import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { syncExamFeeSchedule } from "@/lib/billing/syncFeeSchedule";

// GET /api/v1/settings/exam-types/[id]/entries — exams belonging to one exam type
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await params;
  const entries = await prisma.examCatalogEntry.findMany({
    where: { examTypeId: id, tenantId: session.user.tenantId },
    orderBy: { nameFr: "asc" },
  });
  return NextResponse.json(entries);
}

// POST /api/v1/settings/exam-types/[id]/entries — add a new exam to this type
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const examType = await prisma.examCatalogType.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!examType) return NextResponse.json({ error: "Exam type not found" }, { status: 404 });

    const body = await request.json();
    const {
      code, nameFr, nameEn, price, parameters,
      imagingCatalogItemId, anatomicalZoneId, requiresContrast,
    } = body as {
      code?: string; nameFr?: string; nameEn?: string; price?: number | string;
      parameters?: { name: string; unit: string; referenceRange: string }[];
      imagingCatalogItemId?: string; anatomicalZoneId?: string; requiresContrast?: boolean;
    };

    if (!code?.trim() || !nameFr?.trim()) {
      return NextResponse.json({ error: "code and nameFr are required" }, { status: 400 });
    }

    const entry = await prisma.examCatalogEntry.create({
      data: {
        tenantId: session.user.tenantId,
        examTypeId: id,
        code: code.trim().toUpperCase(),
        nameFr: nameFr.trim(),
        nameEn: nameEn?.trim() || null,
        price: price !== undefined && price !== null && price !== "" ? Number(price) : null,
        parameters: parameters ?? [],
        imagingCatalogItemId: imagingCatalogItemId || null,
        anatomicalZoneId: anatomicalZoneId || null,
        requiresContrast: requiresContrast ?? null,
      },
    });

    await syncExamFeeSchedule({
      tenantId: session.user.tenantId,
      code: entry.code,
      label: entry.nameFr,
      price: entry.price ? Number(entry.price) : null,
      isActive: entry.isActive,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/settings/exam-types/[id]/entries]", error);
    return NextResponse.json({ error: "Failed to create exam (code may already exist)" }, { status: 400 });
  }
}
