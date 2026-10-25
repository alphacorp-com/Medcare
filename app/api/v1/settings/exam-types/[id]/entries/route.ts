import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { validateExamParameters } from "@/lib/exam-catalog/validate-parameters";
import { SCREENING_TEST_TYPES, VIRAL_LOAD_PROGRAMS, type ScreeningTestType } from "@/lib/hiv/input";
import type { ViralLoadProgram } from "@prisma/client";
import { syncExamFeeSchedule } from "@/lib/billing/syncFeeSchedule";
import { FEE_CODE_CONFLICT, feeCodeUsedByOtherCatalog } from "@/lib/billing/feeCodes";

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
      imagingCatalogItemId, anatomicalZoneId, requiresContrast, screeningTestType, viralLoadProgram,
    } = body as {
      code?: string; nameFr?: string; nameEn?: string; price?: number | string;
      parameters?: unknown;
      imagingCatalogItemId?: string; anatomicalZoneId?: string; requiresContrast?: boolean;
      screeningTestType?: unknown;
      viralLoadProgram?: unknown;
    };
    if (viralLoadProgram !== undefined && viralLoadProgram !== null && viralLoadProgram !== "" && !(VIRAL_LOAD_PROGRAMS as readonly unknown[]).includes(viralLoadProgram)) {
      return NextResponse.json({ error: "Invalid viral load program", code: "invalid_viral_load_program" }, { status: 400 });
    }
    if (screeningTestType && viralLoadProgram) {
      return NextResponse.json({ error: "Screening test and viral load are exclusive", code: "invalid_screening_test_type" }, { status: 400 });
    }
    if (screeningTestType !== undefined && screeningTestType !== null && screeningTestType !== "" && !(SCREENING_TEST_TYPES as readonly unknown[]).includes(screeningTestType)) {
      return NextResponse.json({ error: "Invalid screening test type", code: "invalid_screening_test_type" }, { status: 400 });
    }

    if (!code?.trim() || !nameFr?.trim()) {
      return NextResponse.json({ error: "code and nameFr are required" }, { status: 400 });
    }

    // The sheet drives result entry and automatic (critical) flags — validated server-side.
    const parsedParameters = parameters === undefined ? undefined : validateExamParameters(parameters);
    if (parsedParameters && !parsedParameters.ok) {
      return NextResponse.json(
        { error: "Invalid result parameters", code: parsedParameters.code, index: parsedParameters.index },
        { status: 400 }
      );
    }

    if (await feeCodeUsedByOtherCatalog(session.user.tenantId, code, "exam_entry")) {
      return NextResponse.json({ error: "This code is already used by a medical act: both are priced in the same tariff slot", code: FEE_CODE_CONFLICT }, { status: 409 });
    }

    const entry = await prisma.examCatalogEntry.create({
      data: {
        tenantId: session.user.tenantId,
        examTypeId: id,
        code: code.trim().toUpperCase(),
        nameFr: nameFr.trim(),
        nameEn: nameEn?.trim() || null,
        price: price !== undefined && price !== null && price !== "" ? Number(price) : null,
        parameters: (parsedParameters?.ok ? parsedParameters.value : []) as unknown as Prisma.InputJsonValue,
        imagingCatalogItemId: imagingCatalogItemId || null,
        anatomicalZoneId: anatomicalZoneId || null,
        requiresContrast: requiresContrast ?? null,
        screeningTestType: (screeningTestType || null) as ScreeningTestType | null,
        viralLoadProgram: (viralLoadProgram || null) as ViralLoadProgram | null,
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
